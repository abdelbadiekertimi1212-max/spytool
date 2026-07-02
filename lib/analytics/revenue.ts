import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { PAID_TIERS } from "@/lib/billing";

type Client = SupabaseClient<Database>;

export interface RevenueKpis {
  mrr: number;
  arr: number;
  arpu: number;
  paying: number;
  totalUsers: number;
  conversionPct: number;
  byTier: Record<string, number>;
}

export function tierPriceDzd(tier: string): number {
  return PAID_TIERS.find((p) => p.tier === tier)?.priceDzd ?? 0;
}

/** Pure KPI computation from active subscriptions + total user count. */
export function computeRevenue(
  subs: { status: string; package_tier: string }[],
  totalUsers: number,
  priceOf: (tier: string) => number = tierPriceDzd
): RevenueKpis {
  let mrr = 0;
  let paying = 0;
  const byTier: Record<string, number> = {};
  for (const s of subs) {
    if (s.status === "active" && s.package_tier !== "free") {
      mrr += priceOf(s.package_tier);
      paying += 1;
      byTier[s.package_tier] = (byTier[s.package_tier] ?? 0) + 1;
    }
  }
  return {
    mrr,
    arr: mrr * 12,
    arpu: paying > 0 ? Math.round(mrr / paying) : 0,
    paying,
    totalUsers,
    conversionPct: totalUsers > 0 ? (paying / totalUsers) * 100 : 0,
    byTier,
  };
}

/** Read live revenue KPIs (service-role client; internal dashboard only). */
export async function getRevenueKpis(admin: Client): Promise<RevenueKpis> {
  const [{ data: subs }, { count: totalUsers }] = await Promise.all([
    admin.from("subscriptions").select("status, package_tier"),
    admin.from("profiles").select("*", { count: "exact", head: true }),
  ]);
  return computeRevenue(subs ?? [], totalUsers ?? 0);
}
