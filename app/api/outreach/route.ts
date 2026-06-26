import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateOutreach } from "@/lib/groq";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/outreach
 * Body: { storeId: string, locale?: "ar"|"fr"|"en" }
 * Auth required. Builds a prospect profile from the store + its top winner and
 * returns an AI-generated { subject, body, callHook }. The Groq key stays server-side.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subTier } = await supabase
    .from("subscriptions")
    .select("package_tier")
    .eq("user_id", user.id)
    .maybeSingle();
  const rl = await rateLimit(`outreach:${user.id}`, subTier?.package_tier ?? "free");
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Upgrade your plan for higher limits." },
      { status: 429 }
    );
  }

  let payload: { storeId?: string; locale?: string };
  try {
    payload = (await req.json()) as { storeId?: string; locale?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const { data: store, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", payload.storeId)
    .single();

  if (error || !store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const { data: top } = await supabase
    .from("products")
    .select("title, daily_velocity")
    .eq("store_id", store.id)
    .order("daily_velocity", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: winnerCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("is_winner", true);

  try {
    const result = await generateOutreach({
      storeName: store.name || store.url,
      storeUrl: store.url,
      platform: store.platform,
      leadScore: store.lead_score,
      topProduct: top?.title ?? null,
      dailyVelocity: top?.daily_velocity ?? null,
      winnerCount: winnerCount ?? 0,
      locale: payload.locale || "en",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
