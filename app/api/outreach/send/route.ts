import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { sendOutreachEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/outreach/send
 * Body: { to: string, subject: string, text: string }
 * Auth required. Sends the (possibly edited) pitch via Resend. Key stays server-side.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { to?: string; subject?: string; text?: string };
  try {
    payload = (await req.json()) as { to?: string; subject?: string; text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.to || !payload.subject || !payload.text) {
    return NextResponse.json(
      { error: "to, subject and text are required" },
      { status: 400 }
    );
  }

  try {
    const { id } = await sendOutreachEmail({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
