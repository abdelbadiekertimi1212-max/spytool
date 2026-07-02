import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingActionSchema, parseBody } from "@/lib/validation";
import { trackServer } from "@/lib/events/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing — Body: { action: "cancel" | "resume" }
 * Soft cancel/resume at period end (sets cancel_at_period_end). Preserves the
 * Chargily payment flow — billing isn't charged here, only the renewal intent
 * is toggled via the service-role admin client (subscriptions are RLS-locked).
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseBody(req, billingActionSchema);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const cancel = payload.action === "cancel";
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: cancel })
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (cancel) {
    trackServer({ event_name: "downgrade", user_id: user.id, properties: { soft: true } });
  }

  return NextResponse.json({ ok: true, cancel_at_period_end: cancel });
}
