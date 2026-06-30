import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { validateEvent, type TrackInput } from "./schemas";
import { eventBuffer } from "./batch";
import { flushEvents } from "./flush";

type Client = SupabaseClient<Database>;

const MAX_BATCH = Number(process.env.ANALYTICS_BATCH_SIZE) || 50;

/** ENABLE_ANALYTICS defaults ON. */
export function analyticsEnabled(): boolean {
  return process.env.ENABLE_ANALYTICS !== "false";
}

/**
 * Validate + buffer an event, flushing when the batch fills. Returns false if
 * analytics is disabled or the event is invalid (the event is dropped).
 */
export async function track(client: Client, input: TrackInput): Promise<boolean> {
  if (!analyticsEnabled()) return false;
  const event = validateEvent(input);
  if (!event) return false;
  eventBuffer.add(event);
  if (eventBuffer.size() >= MAX_BATCH) await flush(client);
  return true;
}

/** Drain the buffer to the database. Returns the number persisted. */
export async function flush(client: Client): Promise<number> {
  const events = eventBuffer.drain();
  return flushEvents(client, events);
}
