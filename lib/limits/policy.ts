import type { Database } from "../../types/supabase";

export type LimitRule = Database["public"]["Tables"]["limit_rules"]["Row"];
export type UsageWindow = "daily" | "monthly" | "lifetime";

export const RESOURCES = [
  "outreach_per_day",
  "ai_classify_per_day",
  "tracked_stores",
] as const;
export type Resource = (typeof RESOURCES)[number];

/** ENABLE_USAGE_LIMITS defaults OFF (foundations only — no enforcement yet). */
export function usageLimitsEnabled(): boolean {
  return process.env.ENABLE_USAGE_LIMITS === "true";
}

export interface LimitDecision {
  allowed: boolean;
  value: number;
  soft: number | null;
  hard: number | null;
  nearSoft: boolean;
}

export function resolveLimit(
  rules: LimitRule[],
  plan: string,
  resource: string
): LimitRule | null {
  return rules.find((r) => r.plan === plan && r.resource === resource) ?? null;
}

/** Pure decision: is `value` within the matched rule? Disabled/absent → allow. */
export function decide(value: number, rule: LimitRule | null): LimitDecision {
  if (!rule || !rule.enabled) {
    return {
      allowed: true,
      value,
      soft: rule?.soft_limit ?? null,
      hard: rule?.hard_limit ?? null,
      nearSoft: false,
    };
  }
  return {
    allowed: value < rule.hard_limit,
    value,
    soft: rule.soft_limit,
    hard: rule.hard_limit,
    nearSoft: value >= rule.soft_limit,
  };
}
