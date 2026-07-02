import { bucketOf } from "@/lib/limits/rollout";

/** Pricing-page presentation experiment. NEVER affects prices — copy/order only. */
export type PricingVariant = "control" | "A" | "B";

export function pricingExperimentEnabled(): boolean {
  return process.env.PRICING_EXPERIMENT === "true";
}

/** Sticky variant assignment (same FNV bucket as the limits rollout). */
export function getPricingVariant(userId: string): PricingVariant {
  if (!pricingExperimentEnabled()) return "control";
  const b = bucketOf(userId) % 3;
  return b === 0 ? "control" : b === 1 ? "A" : "B";
}
