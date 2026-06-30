import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";

type Client = SupabaseClient<Database>;

/**
 * Housekeeping for media_assets:
 *   - expire FAILED rows older than `maxFailedAgeDays` (so they get retried),
 *   - drop ORPHANS whose product no longer exists.
 * Originals (products.image_url) are NEVER touched — pure additive cleanup.
 */
export async function cleanupMedia(
  client: Client,
  maxFailedAgeDays = 7
): Promise<{ failedRemoved: number; orphansRemoved: number }> {
  const cutoff = new Date(Date.now() - maxFailedAgeDays * 86_400_000).toISOString();

  const { data: failed } = await client
    .from("media_assets")
    .delete()
    .eq("status", "failed")
    .lt("created_at", cutoff)
    .select("id");

  const { data: orphans } = await client
    .from("media_assets")
    .delete()
    .is("product_id", null)
    .select("id");

  return {
    failedRemoved: failed?.length ?? 0,
    orphansRemoved: orphans?.length ?? 0,
  };
}
