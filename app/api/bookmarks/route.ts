import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookmarkSchema, parseBody } from "@/lib/validation";
import { trackServer } from "@/lib/events/collector";
import { inRollout } from "@/lib/limits/rollout";
import { enforceLimit, recordUsage } from "@/lib/limits/enforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/bookmarks — Body: { productId } — save a winner (idempotent). */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseBody(req, bookmarkSchema);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Daily bookmark limit (rollout-gated; first bookmark always within allowance).
  let enforced = false;
  let usageHeadersOut: Record<string, string> = {};
  if (inRollout(user.id)) {
    const { data: subTier } = await supabase
      .from("subscriptions")
      .select("package_tier")
      .eq("user_id", user.id)
      .maybeSingle();
    const admin = createAdminClient();
    const enf = await enforceLimit(admin, user.id, subTier?.package_tier ?? "free", "bookmarks_per_day");
    enforced = enf.enforced;
    usageHeadersOut = enf.headers;
    if (!enf.allowed) {
      trackServer({ event_name: "limit_hit", user_id: user.id, properties: { resource: "bookmarks_per_day" } });
      return NextResponse.json(
        { error: "Daily bookmark limit reached for your plan.", code: "limit_reached", upgrade: true },
        { status: 429, headers: enf.headers }
      );
    }
  }

  const { error } = await supabase
    .from("bookmarks")
    .upsert(
      { user_id: user.id, product_id: payload.productId },
      { onConflict: "user_id,product_id", ignoreDuplicates: true }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (enforced) await recordUsage(createAdminClient(), user.id, "bookmarks_per_day");

  // Track first_bookmark vs bookmark (first save is the activation milestone).
  const { count } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  trackServer({
    event_name: count === 1 ? "first_bookmark" : "bookmark",
    user_id: user.id,
    properties: { product_id: payload.productId },
  });

  return NextResponse.json({ ok: true, saved: true }, { headers: usageHeadersOut });
}

/** DELETE /api/bookmarks — Body: { productId } — remove a saved winner. */
export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseBody(req, bookmarkSchema);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", payload.productId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: false });
}
