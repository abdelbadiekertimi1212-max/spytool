import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "@/lib/chargily";
import { tierPrice } from "@/lib/billing";
import { rateLimit } from "@/lib/ratelimit";
import { checkoutSchema, parseBody } from "@/lib/validation";
import { trackServer } from "@/lib/events/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout — Body: { tier, locale? }
 * Auth required. Creates a Chargily Pay V2 checkout for the selected tier and
 * returns the hosted checkout URL. The user id + tier ride along in metadata so
 * the webhook can upgrade the right subscription on payment.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`checkout:${user.id}`, "free");
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a moment." },
      { status: 429 }
    );
  }

  const payload = await parseBody(req, checkoutSchema);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  trackServer({
    event_name: "checkout_open",
    user_id: user.id,
    properties: { tier: payload.tier },
  });

  const tier = payload.tier;
  const amount = tierPrice(tier);
  if (!amount) {
    return NextResponse.json({ error: "No price for tier" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const locale = payload.locale || "ar";

  try {
    const checkout = await createCheckout({
      amount,
      successUrl: `${siteUrl}/${locale}/dashboard/billing?status=success`,
      failureUrl: `${siteUrl}/${locale}/dashboard/billing?status=failed`,
      webhookEndpoint: `${siteUrl}/api/webhooks/chargily`,
      locale,
      metadata: { user_id: user.id, tier },
    });
    return NextResponse.json({ checkout_url: checkout.checkout_url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
