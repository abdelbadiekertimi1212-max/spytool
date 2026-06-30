import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { checkLimit } from "./check";
import { incrementUsage } from "./increment";
import { inRollout } from "./rollout";
import type { LimitDecision, UsageWindow } from "./policy";

type Client = SupabaseClient<Database>;

const NOT_ENFORCED: LimitDecision = {
  allowed: true,
  value: 0,
  soft: null,
  hard: null,
  nearSoft: false,
};

export interface EnforceResult {
  /** False only when the user is over their hard limit. */
  allowed: boolean;
  /** True when this user is in the enforcement rollout. */
  enforced: boolean;
  decision: LimitDecision;
  headers: Record<string, string>;
}

/** Standard usage headers (limit / remaining / used) for API responses. */
export function usageHeaders(d: LimitDecision): Record<string, string> {
  if (d.hard === null) return {};
  return {
    "X-Usage-Limit": String(d.hard),
    "X-Usage-Used": String(d.value),
    "X-Usage-Remaining": String(Math.max(0, d.hard - d.value)),
  };
}

/**
 * Check a user's usage for `resource`. No DB work when the user isn't in the
 * rollout (returns allowed + `enforced:false`). Does NOT increment — call
 * `recordUsage` only after the action succeeds. Pass a service-role client.
 */
export async function enforceLimit(
  client: Client,
  userId: string,
  plan: string,
  resource: string,
  window: UsageWindow = "daily"
): Promise<EnforceResult> {
  if (!inRollout(userId)) {
    return { allowed: true, enforced: false, decision: NOT_ENFORCED, headers: {} };
  }
  const decision = await checkLimit(client, userId, plan, resource, window);
  return { allowed: decision.allowed, enforced: true, decision, headers: usageHeaders(decision) };
}

/** Atomically count one unit of usage (only after a successful action). */
export async function recordUsage(
  client: Client,
  userId: string,
  resource: string,
  window: UsageWindow = "daily"
): Promise<void> {
  await incrementUsage(client, userId, resource, window);
}
