import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logJson, requestId } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — machine-readable liveness/readiness probe for uptime
 * monitors. 200 healthy / 503 degraded. Checks Supabase reachability and
 * whether Upstash rate limiting is configured. Fast and unauthenticated.
 */
export async function GET() {
  const id = requestId();
  const checks: Record<string, "ok" | "down" | "unconfigured"> = {};

  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .limit(1);
    checks.supabase = error ? "down" : "ok";
  } catch {
    checks.supabase = "down";
  }

  const upstashConfigured =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !process.env.UPSTASH_REDIS_REST_URL.includes("placeholder");
  checks.rateLimiter = upstashConfigured ? "ok" : "unconfigured";

  const healthy = checks.supabase === "ok";
  logJson(healthy ? "info" : "error", "health", "healthcheck", {
    requestId: id,
    checks,
  });

  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks, requestId: id, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
