import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import type { UsageWindow } from "./policy";

type Client = SupabaseClient<Database>;

/**
 * Atomically increment a usage counter via the `increment_usage` SQL function
 * (race-safe upsert; auto-resets the window when expired). Must be called with
 * the service-role client — EXECUTE is granted only to service_role. Returns the
 * post-increment value.
 */
export async function incrementUsage(
  client: Client,
  userId: string,
  metric: string,
  window: UsageWindow = "daily",
  amount = 1
): Promise<number> {
  const { data, error } = await client.rpc("increment_usage", {
    p_user_id: userId,
    p_metric: metric,
    p_window: window,
    p_amount: amount,
  });
  if (error) throw new Error(`increment_usage: ${error.message}`);
  return data ?? 0;
}
