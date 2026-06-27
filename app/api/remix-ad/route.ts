import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/remix-ad — SCAFFOLD for the upcoming Video AI phase.
 *
 * Planned behaviour: given a competitor ad's video URL (from the Ad Library
 * snapshot / fbcdn media), auto-download it and produce a differentiated
 * "remixed" variant — trim, re-encode, re-crop aspect ratio, watermark, light
 * speed/contrast jitter — so the user can launch a fresh creative in minutes.
 *
 * TODO(video-ai): implement with `fluent-ffmpeg` + a bundled binary
 * (`ffmpeg-static`): download the source via the media URL, run the transform
 * pipeline to a temp file, upload the result to Supabase Storage, return its URL.
 * Returns 501 until that pipeline is built.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Not implemented",
      detail:
        "Ad video remixing (fluent-ffmpeg) ships in the Video AI phase. This route is scaffolded.",
    },
    { status: 501 }
  );
}
