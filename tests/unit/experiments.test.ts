import { describe, it, expect, afterEach } from "vitest";

import { getPricingVariant } from "@/lib/experiments";

const ORIG = process.env.PRICING_EXPERIMENT;
afterEach(() => {
  process.env.PRICING_EXPERIMENT = ORIG;
});

describe("getPricingVariant", () => {
  it("is control when the experiment is disabled", () => {
    delete process.env.PRICING_EXPERIMENT;
    expect(getPricingVariant("user-1")).toBe("control");
  });

  it("assigns a sticky variant when enabled", () => {
    process.env.PRICING_EXPERIMENT = "true";
    const v = getPricingVariant("user-1");
    expect(["control", "A", "B"]).toContain(v);
    expect(getPricingVariant("user-1")).toBe(v);
  });

  it("spreads users across more than one variant", () => {
    process.env.PRICING_EXPERIMENT = "true";
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) seen.add(getPricingVariant(`user-${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
