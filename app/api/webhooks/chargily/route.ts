import { NextResponse } from "next/server";

import {
  readMetadata,
  verifyWebhookSignature,
  type ChargilyEvent,
} from "@/lib/chargily";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidTier } from "@/lib/billing";

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

  if (event.type === "checkout.paid") {
    const meta = readMetadata(event.data);
    const userId = typeof meta.user_id === "string" ? meta.user_id : null;
    const tier = typeof meta.tier === "string" ? meta.tier : null;

    if (userId && tier && isPaidTier(tier)) {
      const admin = createAdminClient();
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
    }
  }

  return NextResponse.json({ received: true });
}
