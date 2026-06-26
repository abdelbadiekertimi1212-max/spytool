import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { engineConfig } from "./config";

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

/**
 * Recompute daily_velocity and the is_winner flag for every product.
 *
 * A product is a CONFIRMED WINNER only when BOTH axes are satisfied:
 *   1. Velocity  — daily_velocity >= winner.minDailyVelocity
 *   2. Ad-backing — its store has >= winner.minActiveAds active Meta ads
 */
export async function computeWinners(client: Client): Promise<{
  processed: number;
  winners: number;
}> {
  const { windowDays, minDailyVelocity, minActiveAds } = engineConfig.winner;
  const cutoff = new Date(
    Date.now() - windowDays * 86_400_000
  ).toISOString();

  // Active ad counts per store.
  const activeAdsByStore = new Map<string, number>();
  const { data: activeAds, error: adsErr } = await client
    .from("ads")
    .select("store_id")
    .eq("is_active", true);
  if (adsErr) throw new Error(`Failed to load active ads: ${adsErr.message}`);
  for (const row of activeAds ?? []) {
    activeAdsByStore.set(
      row.store_id,
      (activeAdsByStore.get(row.store_id) ?? 0) + 1
    );
  }

  let processed = 0;
  let winners = 0;
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data: products, error } = await client
      .from("products")
      .select("id, store_id, is_winner, winner_since")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to load products: ${error.message}`);
    if (!products || products.length === 0) break;

    for (const product of products) {
      const { data: snaps, error: snapErr } = await client
        .from("product_snapshots")
        .select("stock, captured_at")
        .eq("product_id", product.id)
        .gte("captured_at", cutoff)
        .order("captured_at", { ascending: true });
      if (snapErr) {
        throw new Error(`Failed to load snapshots: ${snapErr.message}`);
      }

      const { velocity, soldUnits } = computeVelocity(snaps ?? []);
      const activeAds = activeAdsByStore.get(product.store_id) ?? 0;

      const isWinner =
        velocity >= minDailyVelocity && activeAds >= minActiveAds;
      if (isWinner) winners += 1;

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
      if (updErr) {
        throw new Error(`Failed to update product: ${updErr.message}`);
      }

      processed += 1;
    }

    if (products.length < pageSize) break;
  }

  return { processed, winners };
}
