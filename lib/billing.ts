import type { PackageTier } from "@/types/supabase";

/** Paid plan = a tier other than the free trial. */
export type PaidTier = Exclude<PackageTier, "free">;

export interface TierPlan {
  tier: PaidTier;
  /** Monthly price in Algerian Dinar (integer; Chargily minimum is 50 DZD). */
  priceDzd: number;
  /** i18n key suffix for the feature bullets. */
  featureKeys: string[];
}

/** Subscription catalogue. Shared by the pricing UI and the checkout API. */
export const PAID_TIERS: TierPlan[] = [
  { tier: "starter", priceDzd: 1500, featureKeys: ["starter1", "starter2", "starter3"] },
  { tier: "pro", priceDzd: 3500, featureKeys: ["pro1", "pro2", "pro3", "pro4"] },
  { tier: "agency", priceDzd: 9000, featureKeys: ["agency1", "agency2", "agency3", "agency4"] },
];

export function tierPrice(tier: string): number | null {
  const plan = PAID_TIERS.find((p) => p.tier === tier);
  return plan ? plan.priceDzd : null;
}

export function isPaidTier(tier: string): tier is PaidTier {
  return PAID_TIERS.some((p) => p.tier === tier);
}
