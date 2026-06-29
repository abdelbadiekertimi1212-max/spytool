import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, StorePlatform } from "../../types/supabase";
import { computeVelocity } from "./winner";
import { normalizeTitle } from "./text";

type Client = SupabaseClient<Database>;

export { normalizeTitle };

export interface PlatformShare {
  platform: StorePlatform | string;
  count: number;
}

/** Market share: active store count per platform (pie chart). */
export async function marketShareByPlatform(client: Client): Promise<PlatformShare[]> {
  const { data } = await client
    .from("stores")
    .select("platform")
    .eq("is_active", true);
  const counts: Record<string, number> = { shopify: 0, youcan: 0, storeino: 0 };
  for (const s of data ?? []) counts[s.platform] = (counts[s.platform] ?? 0) + 1;
  return Object.entries(counts).map(([platform, count]) => ({ platform, count }));
}

export interface PriceBucket {
  label: string;
  count: number;
}

/** Price distribution histogram (DZD) + average across priced products. */
export async function priceDistribution(client: Client): Promise<{
  distribution: PriceBucket[];
  avgPrice: number;
}> {
  const { data } = await client
    .from("products")
    .select("price")
    .not("price", "is", null)
    .limit(10000);

  const buckets = [
    { label: "< 1k", min: 0, max: 1000 },
    { label: "1k–2k", min: 1000, max: 2000 },
    { label: "2k–3k", min: 2000, max: 3000 },
    { label: "3k–5k", min: 3000, max: 5000 },
    { label: "5k–8k", min: 5000, max: 8000 },
    { label: "8k+", min: 8000, max: Infinity },
  ];
  const distribution: PriceBucket[] = buckets.map((b) => ({ label: b.label, count: 0 }));

  let sum = 0;
  let n = 0;
  for (const p of data ?? []) {
    const price = p.price ?? 0;
    if (!price || price <= 0) continue;
    sum += price;
    n += 1;
    const idx = buckets.findIndex((b) => price >= b.min && price < b.max);
    if (idx >= 0) distribution[idx].count += 1;
  }
  return { distribution, avgPrice: n > 0 ? sum / n : 0 };
}

export interface SaturatedProduct {
  title: string;
  storeCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  image: string | null;
}

/**
 * MARKET SATURATION: group products by normalized title and count how many
 * DISTINCT stores sell the same product. High store-count = saturated/contested.
 */
export async function computeMarketSaturation(
  client: Client,
  limit = 8
): Promise<SaturatedProduct[]> {
  const { data } = await client
    .from("products")
    .select("title, store_id, price, image_url")
    .limit(5000);

  const groups = new Map<
    string,
    { title: string; stores: Set<string>; prices: number[]; image: string | null }
  >();
  for (const p of data ?? []) {
    if (!p.title) continue;
    const key = normalizeTitle(p.title);
    if (key.length < 4) continue;
    let g = groups.get(key);
    if (!g) {
      g = { title: p.title, stores: new Set(), prices: [], image: p.image_url };
      groups.set(key, g);
    }
    g.stores.add(p.store_id);
    if (p.price) g.prices.push(p.price);
    if (!g.image && p.image_url) g.image = p.image_url;
  }

  return Array.from(groups.values())
    .map((g) => ({
      title: g.title,
      storeCount: g.stores.size,
      minPrice: g.prices.length ? Math.min(...g.prices) : null,
      maxPrice: g.prices.length ? Math.max(...g.prices) : null,
      image: g.image,
    }))
    .filter((g) => g.storeCount >= 2)
    .sort((a, b) => b.storeCount - a.storeCount)
    .slice(0, limit);
}

export interface AdStrength {
  storeId: string;
  storeName: string;
  platform: StorePlatform | null;
  daysActive: number;
  adCount: number;
  score: number;
}

/**
 * AD STRENGTH / SCALING INDICATOR. Meta ad budgets are private, so we infer
 * confirmed spend heuristically:
 *
 *   Ad Strength Score = (Days Active) × (Number of duplicate active ad creatives)
 *
 * A store running many creatives for many days is almost certainly scaling a
 * winner. Days Active = age of the oldest still-active ad.
 */
export async function computeAdStrength(
  client: Client,
  limit = 8
): Promise<AdStrength[]> {
  const [{ data: ads }, { data: stores }] = await Promise.all([
    client.from("ads").select("store_id, start_date").eq("is_active", true),
    client.from("stores").select("id, name, url, platform"),
  ]);

  const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));
  const byStore = new Map<string, { count: number; earliest: number | null }>();
  for (const a of ads ?? []) {
    let g = byStore.get(a.store_id);
    if (!g) {
      g = { count: 0, earliest: null };
      byStore.set(a.store_id, g);
    }
    g.count += 1;
    if (a.start_date) {
      const ts = Date.parse(a.start_date);
      if (!Number.isNaN(ts)) g.earliest = g.earliest === null ? ts : Math.min(g.earliest, ts);
    }
  }

  return Array.from(byStore.entries())
    .map(([storeId, g]) => {
      const daysActive =
        g.earliest !== null
          ? Math.max(1, Math.floor((Date.now() - g.earliest) / 86_400_000))
          : 1;
      const s = storeMap.get(storeId);
      return {
        storeId,
        storeName: s?.name || s?.url || "—",
        platform: (s?.platform as StorePlatform) ?? null,
        daysActive,
        adCount: g.count,
        score: daysActive * g.count,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * INVENTORY DELTA → real units sold/day for one product, derived from the
 * snapshot history of its (Shopify) /products.json stock readings over time.
 * Reuses the smart-velocity guard so manual restocks aren't counted as sales.
 */
export async function computeInventoryDeltaForProduct(
  client: Client,
  productId: string
): Promise<{ unitsSoldPerDay: number; totalSold: number }> {
  const { data } = await client
    .from("product_snapshots")
    .select("stock, captured_at")
    .eq("product_id", productId)
    .order("captured_at", { ascending: true });
  const { velocity, soldUnits } = computeVelocity(data ?? []);
  return { unitsSoldPerDay: Number(velocity.toFixed(2)), totalSold: soldUnits };
}

export interface DashboardAnalytics {
  totals: { stores: number; products: number; winners: number; activeAds: number };
  marketShare: PlatformShare[];
  priceDistribution: PriceBucket[];
  avgPrice: number;
  saturation: SaturatedProduct[];
  adStrength: AdStrength[];
}

/** Aggregate everything the analytics dashboard needs in one parallel pass. */
export async function getDashboardAnalytics(client: Client): Promise<DashboardAnalytics> {
  const head = { count: "exact" as const, head: true };
  const [
    storesCount,
    productsCount,
    winnersCount,
    adsCount,
    share,
    prices,
    saturation,
    adStrength,
  ] = await Promise.all([
    client.from("stores").select("*", head).eq("is_active", true),
    client.from("products").select("*", head),
    client.from("products").select("*", head).eq("is_winner", true),
    client.from("ads").select("*", head).eq("is_active", true),
    marketShareByPlatform(client),
    priceDistribution(client),
    computeMarketSaturation(client),
    computeAdStrength(client),
  ]);

  return {
    totals: {
      stores: storesCount.count ?? 0,
      products: productsCount.count ?? 0,
      winners: winnersCount.count ?? 0,
      activeAds: adsCount.count ?? 0,
    },
    marketShare: share,
    priceDistribution: prices.distribution,
    avgPrice: prices.avgPrice,
    saturation,
    adStrength,
  };
}
