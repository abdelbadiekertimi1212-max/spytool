import { describe, it, expect, afterEach } from "vitest";

import { bucketOf, rolloutPercent, inRollout } from "@/lib/limits/rollout";

const ENABLED = process.env.ENABLE_USAGE_LIMITS;
const ROLLOUT = process.env.LIMITS_ROLLOUT;
afterEach(() => {
  process.env.ENABLE_USAGE_LIMITS = ENABLED;
  process.env.LIMITS_ROLLOUT = ROLLOUT;
});

describe("limits rollout", () => {
  it("bucketOf is deterministic and within 0–99", () => {
    const b = bucketOf("user-123");
    expect(b).toBe(bucketOf("user-123"));
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
  });

  it("rolloutPercent parses and clamps", () => {
    process.env.LIMITS_ROLLOUT = "150";
    expect(rolloutPercent()).toBe(100);
    process.env.LIMITS_ROLLOUT = "-5";
    expect(rolloutPercent()).toBe(0);
    process.env.LIMITS_ROLLOUT = "abc";
    expect(rolloutPercent()).toBe(0);
    process.env.LIMITS_ROLLOUT = "25";
    expect(rolloutPercent()).toBe(25);
  });

  it("is off when the flag is disabled (even at 100%)", () => {
    process.env.ENABLE_USAGE_LIMITS = "false";
    process.env.LIMITS_ROLLOUT = "100";
    expect(inRollout("anyone")).toBe(false);
  });

  it("includes everyone at 100% and no one at 0%", () => {
    process.env.ENABLE_USAGE_LIMITS = "true";
    process.env.LIMITS_ROLLOUT = "100";
    expect(inRollout("user-x")).toBe(true);
    process.env.LIMITS_ROLLOUT = "0";
    expect(inRollout("user-x")).toBe(false);
  });

  it("is sticky to the user's bucket vs the percentage", () => {
    process.env.ENABLE_USAGE_LIMITS = "true";
    const id = "stable-user";
    const b = bucketOf(id);
    process.env.LIMITS_ROLLOUT = String(b + 1);
    expect(inRollout(id)).toBe(true);
    process.env.LIMITS_ROLLOUT = String(b);
    expect(inRollout(id)).toBe(false);
  });
});
