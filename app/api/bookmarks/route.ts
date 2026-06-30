import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { bookmarkSchema, parseBody } from "@/lib/validation";
import { trackServer } from "@/lib/events/collector";

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

  const { error } = await supabase
    .from("bookmarks")
    .upsert(
      { user_id: user.id, product_id: payload.productId },
      { onConflict: "user_id,product_id", ignoreDuplicates: true }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  return NextResponse.json({ ok: true, saved: true });
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
