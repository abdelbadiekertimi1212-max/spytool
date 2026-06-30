import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";

type Client = SupabaseClient<Database>;

/**
 * Housekeeping: zero out any counter whose window has elapsed. The RPC also
 * auto-resets lazily on the next increment, so this is just a tidy backstop
 * (e.g. for a daily cron). Returns the number of counters reset.
 */
export async function resetExpired(client: Client): Promise<number> {
  const { data } = await client
    .from("usage_counters")
    .update({ value: 0 })
    .lte("reset_at", new Date().toISOString())
    .select("user_id");
  return data?.length ?? 0;
}

/** Force-reset a specific user's counters (optionally a single metric). */
export async function resetUsage(
  client: Client,
  userId: string,
  metric?: string
): Promise<void> {
  let query = client.from("usage_counters").update({ value: 0 }).eq("user_id", userId);
  if (metric) query = query.eq("metric", metric);
  await query;
}
