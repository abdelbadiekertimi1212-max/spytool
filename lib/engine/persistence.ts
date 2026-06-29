import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import type { NormalizedAd, ScrapeResult } from "./types";
import { sanitizeText } from "./http";
import { tagProductsByNiche } from "./classifier";

type Client = SupabaseClient<Database>;
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type SnapshotInsert =
  Database["public"]["Tables"]["product_snapshots"]["Insert"];
type AdInsert = Database["public"]["Tables"]["ads"]["Insert"];

/**
 * Upsert scraped products for a store and append a stock snapshot for each.
 * Products conflict on (store_id, external_id); snapshots are append-only and
 * feed the velocity calculation.
 */
export async function persistScrape(
  client: Client,
  storeId: string,
  result: ScrapeResult
): Promise<{ upserted: number; snapshots: number }> {
  if (result.products.length === 0) {
    await touchStoreScraped(client, storeId);
    return { upserted: 0, snapshots: 0 };
  }

  const productRows: ProductInsert[] = result.products.map((p) => ({
    store_id: storeId,
    external_id: p.externalId,
    handle: p.handle,
    title: sanitizeText(p.title, 300) ?? p.title,
    description: sanitizeText(p.description, 2000),
    price: p.price,
    compare_at_price: p.compareAtPrice,
    currency: p.currency,
    image_url: p.imageUrl,
    product_url: p.productUrl,
    current_stock: p.stock,
    last_checked_at: new Date().toISOString(),
  }));

  const { data: upserted, error } = await client
    .from("products")
    .upsert(productRows, { onConflict: "store_id,external_id" })
    .select("id, external_id, initial_stock, niche");

  if (error) {
    throw new Error(`Failed to upsert products: ${error.message}`);
  }

  // Seed initial_stock the first time we ever see a product with a known stock.
  const idByExternal = new Map<string, string>();
  const initialStockUpdates: { id: string; initial_stock: number }[] = [];
  for (const row of upserted ?? []) {
    if (row.external_id) idByExternal.set(row.external_id, row.id);
  }
  for (const p of result.products) {
    const id = p.externalId ? idByExternal.get(p.externalId) : undefined;
    const existing = (upserted ?? []).find((r) => r.external_id === p.externalId);
    if (id && p.stock !== null && existing && existing.initial_stock === null) {
      initialStockUpdates.push({ id, initial_stock: p.stock });
    }
  }
  for (const upd of initialStockUpdates) {
    await client
      .from("products")
      .update({ initial_stock: upd.initial_stock })
      .eq("id", upd.id);
  }

  const snapshotRows: SnapshotInsert[] = [];
  for (const p of result.products) {
    const id = p.externalId ? idByExternal.get(p.externalId) : undefined;
    if (!id) continue;
    snapshotRows.push({ product_id: id, stock: p.stock, price: p.price });
  }

  if (snapshotRows.length > 0) {
    const { error: snapErr } = await client
      .from("product_snapshots")
      .insert(snapshotRows);
    if (snapErr) {
      throw new Error(`Failed to insert snapshots: ${snapErr.message}`);
    }
  }

  // AI niche auto-tagging for brand-new products (those still without a niche).
  // Non-fatal: scraping must never fail because the LLM is unavailable.
  try {
    const untagged: { id: string; title: string; description?: string | null }[] = [];
    for (const row of upserted ?? []) {
      if (row.niche) continue;
      const src = result.products.find((p) => p.externalId === row.external_id);
      if (src) untagged.push({ id: row.id, title: src.title, description: src.description });
    }
    if (untagged.length > 0) await tagProductsByNiche(client, untagged);
  } catch (err) {
    console.error(`[persist] niche tagging skipped: ${(err as Error).message}`);
  }

  await touchStoreScraped(client, storeId);
  return { upserted: productRows.length, snapshots: snapshotRows.length };
}

async function touchStoreScraped(client: Client, storeId: string) {
  await client
    .from("stores")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", storeId);
}

/** Exact placeholder titles (case-insensitive) that indicate junk/test data. */
const PLACEHOLDER_TITLES = [
  "test",
  "test product",
  "produit test",
  "test produit",
  "sample product",
  "منتج تجريبي",
  "تجربة",
];

/**
 * ZERO FAKE DATA: hard-delete junk products — exact placeholder titles or a
 * zero price. Returns the number removed. Safe to run after every inventory
 * pass; it never touches products with a real title and a positive/null price.
 */
export async function purgePlaceholders(client: Client): Promise<number> {
  let removed = 0;

  const titleFilter = PLACEHOLDER_TITLES.map((tName) => `title.ilike.${tName}`).join(
    ","
  );
  const { data: byTitle } = await client
    .from("products")
    .delete()
    .or(titleFilter)
    .select("id");
  removed += byTitle?.length ?? 0;

  const { data: byPrice } = await client
    .from("products")
    .delete()
    .eq("price", 0)
    .select("id");
  removed += byPrice?.length ?? 0;

  return removed;
}

/**
 * Mark every ad for a store inactive, then upsert the freshly-fetched active
 * ads. This keeps `is_active` truthful: ads that dropped out of the live Ad
 * Library result are flipped to inactive in the same pass.
 */
export async function persistAds(
  client: Client,
  storeId: string,
  ads: NormalizedAd[]
): Promise<number> {
  await client
    .from("ads")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .eq("is_active", true);

  if (ads.length > 0) {
    const rows: AdInsert[] = ads.map((ad) => ({
      store_id: storeId,
      meta_ad_id: ad.metaAdId,
      // Prefer the real scraped creative media; fall back to the library link.
      ad_creative_url: ad.mediaUrl ?? ad.snapshotUrl,
      creative_type: ad.creativeType,
      ad_copy: sanitizeText(ad.adCopy, 2000),
      cta_text: sanitizeText(ad.ctaText, 200),
      landing_url: ad.snapshotUrl ?? ad.landingUrl,
      platform: ad.platform,
      start_date: ad.startDate ? ad.startDate.slice(0, 10) : null,
      end_date: ad.endDate ? ad.endDate.slice(0, 10) : null,
      is_active: ad.isActive,
      raw: ad.raw as AdInsert["raw"],
    }));

    const { error } = await client
      .from("ads")
      .upsert(rows, { onConflict: "meta_ad_id" });
    if (error) {
      throw new Error(`Failed to upsert ads: ${error.message}`);
    }
  }

  await client
    .from("stores")
    .update({ ads_checked_at: new Date().toISOString() })
    .eq("id", storeId);

  return ads.length;
}
