import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Enabled only when real Upstash credentials are present. Otherwise the limiter
// degrades to allow-all so local dev / unconfigured envs don't break.
const enabled =
  !!url &&
  !!token &&
  !url.includes("placeholder") &&
  !token.includes("placeholder");

const redis = enabled ? new Redis({ url: url as string, token: token as string }) : null;

const WINDOW = "60 s";

/** Requests per 60s window, tiered by subscription package_tier. */
const TIER_LIMITS: Record<string, number> = {
  free: 10,
  starter: 30,
  pro: 120,
  agency: 300,
};

const limiters = new Map<number, Ratelimit>();
function limiterFor(limit: number): Ratelimit | null {
  if (!redis) return null;
  const existing = limiters.get(limit);
  if (existing) return existing;
  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, WINDOW),
    prefix: "winnerradar:rl",
    analytics: false,
  });
  limiters.set(limit, created);
  return created;
}

export interface RateResult {
  success: boolean;
  limit: number;
  remaining: number;
}

const WINDOW_MS = 60_000;

// In-memory fallback so rate limiting STILL BLOCKS when Upstash is not
// configured (defense in depth). Per-process only — for multi-instance
// production, configure Upstash so the window is shared across instances.
const memHits = new Map<string, number[]>();

function memoryLimit(identifier: string, limit: number): RateResult {
  const now = Date.now();
  // Light prune to bound memory.
  if (memHits.size > 10_000) memHits.clear();
  const recent = (memHits.get(identifier) ?? []).filter(
    (ts) => now - ts < WINDOW_MS
  );
  if (recent.length >= limit) {
    memHits.set(identifier, recent);
    return { success: false, limit, remaining: 0 };
  }
  recent.push(now);
  memHits.set(identifier, recent);
  return { success: true, limit, remaining: Math.max(0, limit - recent.length) };
}

/**
 * Sliding-window rate limit keyed by `identifier`, with the window size chosen
 * by the user's subscription tier. Uses Upstash Redis when configured; otherwise
 * falls back to an in-memory window that still blocks abusers.
 */
export async function rateLimit(
  identifier: string,
  tier: string = "free"
): Promise<RateResult> {
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const limiter = limiterFor(limit);
  if (!limiter) return memoryLimit(identifier, limit);
  const res = await limiter.limit(identifier);
  return { success: res.success, limit: res.limit, remaining: res.remaining };
}
