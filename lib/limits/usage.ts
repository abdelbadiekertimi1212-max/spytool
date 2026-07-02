import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { resolveLimit } from "./policy";

type Client = SupabaseClient<Database>;

export type UsageState = "healthy" | "near" | "grace" | "reached";

export interface ResourceUsage {
  resource: string;
  used: number;
  soft: number | null;
  hard: number | null;
  remaining: number | null;
  state: UsageState;
  resetAt: string | null;
}

/** The daily resources surfaced on the usage dashboard. */
export const TRACKED_RESOURCES = [
  "winners_per_day",
  "bookmarks_per_day",
  "outreach_per_day",
] as const;

/** Pure state from a usage value vs the soft/hard band. `hard===null` = unlimited. */
export function usageState(
  used: number,
  soft: number | null,
  hard: number | null
): UsageState {
  if (hard === null) return "healthy";
  if (used >= hard) return "reached";
  if (soft !== null && used >= soft) return "grace";
  if (soft !== null && used >= Math.ceil(soft * 0.8)) return "near";
  return "healthy";
}

/** Per-resource daily usage for a user on a plan (free/trial → unlimited). */
export async function getUsageSummary(
  client: Client,
  userId: string,
  plan: string
): Promise<ResourceUsage[]> {
  const [{ data: rules }, { data: counters }] = await Promise.all([
    client.from("limit_rules").select("*").eq("plan", plan),
    client
      .from("usage_counters")
      .select("metric, window, value, reset_at")
      .eq("user_id", userId)
      .eq("window", "daily"),
  ]);

  return TRACKED_RESOURCES.map((resource) => {
    const rule = resolveLimit(rules ?? [], plan, resource);
    const counter = (counters ?? []).find((c) => c.metric === resource);
    let used = counter?.value ?? 0;
    if (counter?.reset_at && new Date(counter.reset_at).getTime() <= Date.now()) {
      used = 0;
    }
    const active = Boolean(rule && rule.enabled);
    const soft = active ? rule!.soft_limit : null;
    const hard = active ? rule!.hard_limit : null;
    const remaining = hard === null ? null : Math.max(0, hard - used);
    return {
      resource,
      used,
      soft,
      hard,
      remaining,
      state: usageState(used, soft, hard),
      resetAt: counter?.reset_at ?? null,
    };
  });
}
