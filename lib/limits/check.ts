import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import {
  decide,
  resolveLimit,
  usageLimitsEnabled,
  type LimitDecision,
  type UsageWindow,
} from "./policy";

type Client = SupabaseClient<Database>;

const ALLOW_ALL: LimitDecision = {
  allowed: true,
  value: 0,
  soft: null,
  hard: null,
  nearSoft: false,
};

/**
 * Check whether `userId` (on `plan`) may consume `resource`. No-op (always
 * allowed) when ENABLE_USAGE_LIMITS is off — so enabling enforcement is a pure
 * flag flip with zero behavior change today. Reads the rule + current counter;
 * an expired window counts as 0.
 */
export async function checkLimit(
  client: Client,
  userId: string,
  plan: string,
  resource: string,
  window: UsageWindow = "daily"
): Promise<LimitDecision> {
  if (!usageLimitsEnabled()) return ALLOW_ALL;

  const [{ data: rules }, { data: counter }] = await Promise.all([
    client.from("limit_rules").select("*").eq("plan", plan).eq("resource", resource),
    client
      .from("usage_counters")
      .select("value, reset_at")
      .eq("user_id", userId)
      .eq("metric", resource)
      .eq("window", window)
      .maybeSingle(),
  ]);

  let value = counter?.value ?? 0;
  if (counter?.reset_at && new Date(counter.reset_at).getTime() <= Date.now()) {
    value = 0;
  }
  return decide(value, resolveLimit(rules ?? [], plan, resource));
}
