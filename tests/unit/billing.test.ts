import { describe, it, expect } from "vitest";

import { tierPrice, isPaidTier, PAID_TIERS } from "@/lib/billing";

describe("billing tiers", () => {
  it("prices the paid tiers in DZD", () => {
    expect(tierPrice("starter")).toBe(1500);
    expect(tierPrice("pro")).toBe(3500);
    expect(tierPrice("agency")).toBe(9000);
  });

  it("returns null for free / unknown tiers", () => {
    expect(tierPrice("free")).toBeNull();
    expect(tierPrice("enterprise")).toBeNull();
  });

  it("recognizes only the paid tiers", () => {
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("nonsense")).toBe(false);
  });

  it("exposes exactly three paid plans", () => {
    expect(PAID_TIERS.map((p) => p.tier)).toEqual(["starter", "pro", "agency"]);
  });
});
