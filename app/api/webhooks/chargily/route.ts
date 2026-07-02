import { NextResponse } from "next/server";

import {
  readMetadata,
  verifyWebhookSignature,
  type ChargilyEvent,
} from "@/lib/chargily";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidTier } from "@/lib/billing";
import { trackServer } from "@/lib/events/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/chargily
 * Verifies the Chargily signature against the RAW body, then on `checkout.paid`
 * upgrades the user's subscription (active tier, +30d period) using the
 * service-role admin client (no user session in a webhook).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let event: ChargilyEvent;
  try {
    event = JSON.parse(rawBody) as ChargilyEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!event.id || !event.type) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency / replay protection: record the event id once. If it already
  // exists, this is a duplicate (or replayed) delivery — ack without re-applying.
  const { data: recorded, error: dedupeErr } = await admin
    .from("processed_webhook_events")
    .upsert(
      { event_id: event.id, provider: "chargily", event_type: event.type },
      { onConflict: "event_id", ignoreDuplicates: true }
    )
    .select("event_id");
  if (dedupeErr) {
    return NextResponse.json({ error: dedupeErr.message }, { status: 500 });
  }
  if (!recorded || recorded.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.paid") {
    const meta = readMetadata(event.data);
    const userId = typeof meta.user_id === "string" ? meta.user_id : null;
    const tier = typeof meta.tier === "string" ? meta.tier : null;

    if (userId && tier && isPaidTier(tier)) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 86_400_000);
      const { error } = await admin
        .from("subscriptions")
        .update({
          status: "active",
          package_tier: tier,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        })
        .eq("user_id", userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Server-side analytics collector — fire-and-forget, never blocks/throws,
      // gated by ENABLE_ANALYTICS. Does not affect the webhook response.
      trackServer({
        event_name: "subscription_change",
        user_id: userId,
        properties: { tier, source: "chargily" },
      });
      trackServer({ event_name: "checkout_complete", user_id: userId, properties: { tier } });
      trackServer({ event_name: "upgrade_success", user_id: userId, properties: { tier } });
    }
  }

  return NextResponse.json({ received: true });
}
