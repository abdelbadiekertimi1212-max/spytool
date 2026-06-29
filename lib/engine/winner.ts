import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { engineConfig } from "./config";
import { normalizeTitle } from "./text";

type Client = SupabaseClient<Database>;

interface VelocityResult {
  velocity: number;
  soldUnits: number;
}

/**
 * Compute units-sold-per-day from a series of stock snapshots.
 *
 * SMART VELOCITY: only GRADUAL positive drops count as sales. A drop is treated
 * as real sell-through when `0 < drop < maxSaleDrop`. Sudden massive drops
 * (>= maxSaleDrop, e.g. 1000→0) are flagged as MANUAL inventory adjustments and
 * excluded from both the sold-units total and the elapsed-time denominator, so
 * a merchant resetting stock can't manufacture a false-positive winner.
 * Restocks (negative drops) are likewise ignored.
 */
export function computeVelocity(
  snapshots: { stock: number | null; captured_at: string }[],
  maxSaleDrop: number = engineConfig.winner.maxSaleDropPerWindow
): VelocityResult {
  const known = snapshots
    .filter((s): s is { stock: number; captured_at: string } => s.stock !== null)
    .sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    );

  if (known.length < 2) return { velocity: 0, soldUnits: 0 };

  let soldUnits = 0;
  let countedMs = 0;
  for (let i = 1; i < known.length; i += 1) {
    const drop = known[i - 1].stock - known[i].stock;
    const intervalMs =
      new Date(known[i].captured_at).getTime() -
      new Date(known[i - 1].captured_at).getTime();

    // Manual adjustment / restock → skip this interval entirely.
    if (drop <= 0 || drop >= maxSaleDrop) continue;

    soldUnits += drop;
    countedMs += intervalMs;
  }

  const countedDays = countedMs / 86_400_000;
  if (countedDays <= 0) return { velocity: 0, soldUnits };

  return { velocity: soldUnits / countedDays, soldUnits };
}

interface StoreAdStrength {
  /** Distinct active creatives (by creative URL / ad id). */
  distinctCreatives: number;
  /** Oldest active-ad start timestamp (ms), or null. */
  earliestStart: number | null;
}

/**
 * THE 3D WINNER VERIFICATION ALGORITHM. A product earns "Confirmed Winner"
 * ONLY if all axes pass:
 *
 *   1. VALID VELOCITY — gradual stock depletion >= minDailyVelocity. The smart-
 *      velocity guard in computeVelocity rejects sudden massive drops (manual
 *      inventory resets), so only real sell-through counts.
 *   2. AD-SPEND COMMITMENT — the store has >= 1 active ad running longer than
 *      minAdAgeDays AND is running >= minDistinctCreatives different creatives.
 *   3. MARKET CONSENSUS (boost) — if the same product (normalized title) is
 *      being scaled by more than one store, the store's lead_score is boosted.
 */
export async function computeWinners(client: Client): Promise<{
  processed: number;
  winners: number;
  leadBoosts: number;
}> {
  const {
    windowDays,
    minDailyVelocity,
    minAdAgeDays,
    minDistinctCreatives,
    consensusBoost,
  } = engineConfig.winner;
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const adAgeCutoff = Date.now() - minAdAgeDays * 86_400_000;

  // Per-store ad strength (axis 2).
  const adByStore = new Map<string, StoreAdStrength>();
  const { data: activeAds, error: adsErr } = await client
    .from("ads")
    .select("store_id, start_date, ad_creative_url, meta_ad_id")
    .eq("is_active", true);
  if (adsErr) throw new Error(`Failed to load active ads: ${adsErr.message}`);

  const creativeSets = new Map<string, Set<string>>();
  for (const row of activeAds ?? []) {
    let s = adByStore.get(row.store_id);
    if (!s) {
      s = { distinctCreatives: 0, earliestStart: null };
      adByStore.set(row.store_id, s);
      creativeSets.set(row.store_id, new Set());
    }
    creativeSets.get(row.store_id)!.add(row.ad_creative_url ?? row.meta_ad_id ?? "");
    if (row.start_date) {
      const ts = Date.parse(row.start_date);
      if (!Number.isNaN(ts)) {
        s.earliestStart = s.earliestStart === null ? ts : Math.min(s.earliestStart, ts);
      }
    }
  }
  for (const [storeId, set] of Array.from(creativeSets)) {
    adByStore.get(storeId)!.distinctCreatives = set.size;
  }

  const adCommitmentOK = (storeId: string): boolean => {
    const s = adByStore.get(storeId);
    if (!s) return false;
    const longRunning = s.earliestStart !== null && s.earliestStart <= adAgeCutoff;
    return longRunning && s.distinctCreatives >= minDistinctCreatives;
  };

  // Market consensus (axis 3): normalized title → set of stores selling it.
  const consensusByTitle = new Map<string, Set<string>>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("products")
      .select("title, store_id")
      .range(from, from + 999);
    if (error) throw new Error(`Failed to scan titles: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const p of data) {
      if (!p.title) continue;
      const key = normalizeTitle(p.title);
      if (key.length < 4) continue;
      let set = consensusByTitle.get(key);
      if (!set) {
        set = new Set();
        consensusByTitle.set(key, set);
      }
      set.add(p.store_id);
    }
    if (data.length < 1000) break;
  }

  let processed = 0;
  let winners = 0;
  const consensusWinnersByStore = new Map<string, number>();
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data: products, error } = await client
      .from("products")
      .select("id, store_id, title, is_winner, winner_since")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to load products: ${error.message}`);
    if (!products || products.length === 0) break;

    // BULK-FETCH snapshots for the entire batch in paged queries (fixes the
    // N+1: previously one snapshot query per product). Group by product in JS.
    const productIds = products.map((p) => p.id);
    const snapsByProduct = new Map<
      string,
      { stock: number | null; captured_at: string }[]
    >();
    const snapPage = 1000;
    for (let s = 0; ; s += snapPage) {
      const { data: snaps, error: snapErr } = await client
        .from("product_snapshots")
        .select("product_id, stock, captured_at")
        .in("product_id", productIds)
        .gte("captured_at", cutoff)
        .order("captured_at", { ascending: true })
        .range(s, s + snapPage - 1);
      if (snapErr) throw new Error(`Failed to load snapshots: ${snapErr.message}`);
      if (!snaps || snaps.length === 0) break;
      for (const row of snaps) {
        let arr = snapsByProduct.get(row.product_id);
        if (!arr) {
          arr = [];
          snapsByProduct.set(row.product_id, arr);
        }
        arr.push({ stock: row.stock, captured_at: row.captured_at });
      }
      if (snaps.length < snapPage) break;
    }

    for (const product of products) {
      const { velocity, soldUnits } = computeVelocity(
        snapsByProduct.get(product.id) ?? []
      );

      const velocityOK = velocity >= minDailyVelocity;
      const adOK = adCommitmentOK(product.store_id);
      const isWinner = velocityOK && adOK;
      if (isWinner) winners += 1;

      const consensus = product.title
        ? (consensusByTitle.get(normalizeTitle(product.title))?.size ?? 0) > 1
        : false;
      if (isWinner && consensus) {
        consensusWinnersByStore.set(
          product.store_id,
          (consensusWinnersByStore.get(product.store_id) ?? 0) + 1
        );
      }

      const winnerSince = isWinner
        ? product.winner_since ?? new Date().toISOString()
        : null;

      const { error: updErr } = await client
        .from("products")
        .update({
          daily_velocity: Number(velocity.toFixed(2)),
          total_sold: soldUnits,
          is_winner: isWinner,
          winner_since: winnerSince,
        })
        .eq("id", product.id);
      if (updErr) throw new Error(`Failed to update product: ${updErr.message}`);

      processed += 1;
    }

    if (products.length < pageSize) break;
  }

  // Axis 3: boost lead_score for stores scaling consensus winners.
  let leadBoosts = 0;
  for (const [storeId, consensusWinners] of Array.from(consensusWinnersByStore)) {
    const ad = adByStore.get(storeId);
    const base =
      consensusWinners * consensusBoost +
      (ad ? Math.min(ad.distinctCreatives * 5, 20) : 0);
    const score = Math.max(0, Math.min(100, base));
    const { error } = await client
      .from("stores")
      .update({ lead_score: score })
      .eq("id", storeId);
    if (!error) leadBoosts += 1;
  }

  return { processed, winners, leadBoosts };
}
