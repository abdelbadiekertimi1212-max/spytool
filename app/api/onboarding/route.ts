import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, parseBody } from "@/lib/validation";
import { trackServer } from "@/lib/events/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding — Body: { preferred_categories?, experience_level?, country? }
 * Auth required. Saves first-run profile prefs and marks onboarding complete.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await parseBody(req, onboardingSchema);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      preferred_categories: payload.preferred_categories ?? [],
      experience_level: payload.experience_level ?? null,
      country: payload.country ?? null,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  trackServer({
    event_name: "onboarding_completed",
    user_id: user.id,
    properties: {
      categories: payload.preferred_categories?.length ?? 0,
      experience_level: payload.experience_level ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
