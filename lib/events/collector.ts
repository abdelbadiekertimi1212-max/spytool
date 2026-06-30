import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { track, flush, analyticsEnabled } from "./track";
import type { TrackInput } from "./schemas";

/**
 * Fire-and-forget server-side collector. Drop into any server route/handler:
 *   trackServer({ event_name: "subscription_change", user_id, properties });
 *
 * It NEVER throws and NEVER blocks the caller's response (the promise is voided
 * and all errors are swallowed) — analytics can't change behavior or contracts.
 */
export function trackServer(input: TrackInput): void {
  if (!analyticsEnabled()) return;
  void (async () => {
    try {
      const admin = createAdminClient();
      await track(admin, input);
      await flush(admin);
    } catch {
      /* analytics is best-effort; request flow is unaffected */
    }
  })();
}
