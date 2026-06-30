import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../../types/supabase";
import type { TrackInput } from "./schemas";

type Client = SupabaseClient<Database>;
type EventInsert = Database["public"]["Tables"]["analytics_events"]["Insert"];

/**
 * Persist a batch of validated events into analytics_events. Best-effort:
 * returns the count written and never throws (analytics must not break callers).
 */
export async function flushEvents(client: Client, events: TrackInput[]): Promise<number> {
  if (events.length === 0) return 0;
  const rows: EventInsert[] = events.map((e) => ({
    event_name: e.event_name,
    user_id: e.user_id ?? null,
    anonymous_id: e.anonymous_id ?? null,
    session_id: e.session_id ?? null,
    properties: (e.properties ?? {}) as unknown as Json,
  }));
  const { error } = await client.from("analytics_events").insert(rows);
  if (error) {
    console.error("[events] flush failed:", error.message);
    return 0;
  }
  return rows.length;
}
