import { usageLimitsEnabled } from "./policy";

/** LIMITS_ROLLOUT = percent of users (0–100) under enforcement. Default 0. */
export function rolloutPercent(): number {
  const v = Number(process.env.LIMITS_ROLLOUT);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(v)));
}

/** Stable FNV-1a hash of a user id → bucket 0–99 (sticky assignment). */
export function bucketOf(userId: string): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i += 1) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0) % 100;
}

/**
 * Is this user under limit enforcement? Requires ENABLE_USAGE_LIMITS=true AND
 * the user's sticky bucket to fall under LIMITS_ROLLOUT. Deterministic per user,
 * so a user never flips in/out as the rollout grows monotonically.
 */
export function inRollout(userId: string): boolean {
  if (!usageLimitsEnabled()) return false;
  return bucketOf(userId) < rolloutPercent();
}
