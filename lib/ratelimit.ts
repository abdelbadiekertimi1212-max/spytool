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

/**
 * Sliding-window rate limit keyed by `identifier`, with the window size chosen
 * by the user's subscription tier. No-ops (allows) when Upstash isn't configured.
 */
export async function rateLimit(
  identifier: string,
  tier: string = "free"
): Promise<RateResult> {
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const limiter = limiterFor(limit);
  if (!limiter) return { success: true, limit, remaining: limit };
  const res = await limiter.limit(identifier);
  return { success: res.success, limit: res.limit, remaining: res.remaining };
}
