import { z } from "zod";

/** The server-side event taxonomy (no client SDK). */
export const EVENT_NAMES = [
  "signup",
  "login",
  "trial_started",
  "dashboard_view",
  "winner_open",
  "bookmark",
  "checkout",
  "subscription_change",
  "queue_failure",
  "image_rehost",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export const eventSchema = z.object({
  event_name: z.enum(EVENT_NAMES),
  user_id: z.string().uuid().nullable().optional(),
  anonymous_id: z.string().max(128).nullable().optional(),
  session_id: z.string().max(128).nullable().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export type TrackInput = z.infer<typeof eventSchema>;

/** Parse + validate an event; returns null on failure (caller drops it). */
export function validateEvent(input: unknown): TrackInput | null {
  const result = eventSchema.safeParse(input);
  return result.success ? result.data : null;
}
