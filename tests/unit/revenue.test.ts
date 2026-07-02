import { describe, it, expect, afterEach } from "vitest";

import { computeRevenue } from "@/lib/analytics/revenue";
import { isInternalEmail } from "@/lib/internal";

const priceOf = (t: string) => (t === "pro" ? 3500 : t === "starter" ? 1500 : 0);

describe("computeRevenue", () => {
  it("computes MRR/ARR/ARPU/conversion from active paid subs", () => {
    const subs = [
      { status: "active", package_tier: "pro" },
      { status: "active", package_tier: "starter" },
      { status: "trialing", package_tier: "free" },
      { status: "active", package_tier: "free" },
      { status: "canceled", package_tier: "pro" },
    ];
    const r = computeRevenue(subs, 10, priceOf);
    expect(r.mrr).toBe(5000);
    expect(r.arr).toBe(60000);
    expect(r.paying).toBe(2);
    expect(r.arpu).toBe(2500);
    expect(r.conversionPct).toBe(20);
    expect(r.byTier).toEqual({ pro: 1, starter: 1 });
  });

  it("is all-zero with no users", () => {
    const r = computeRevenue([], 0, priceOf);
    expect(r.mrr).toBe(0);
    expect(r.arpu).toBe(0);
    expect(r.conversionPct).toBe(0);
  });
});

describe("isInternalEmail", () => {
  const ORIG = process.env.INTERNAL_EMAILS;
  afterEach(() => {
    process.env.INTERNAL_EMAILS = ORIG;
  });
  it("false when allowlist empty / no email", () => {
    delete process.env.INTERNAL_EMAILS;
    expect(isInternalEmail("a@b.com")).toBe(false);
    expect(isInternalEmail(null)).toBe(false);
  });
  it("matches case-insensitively", () => {
    process.env.INTERNAL_EMAILS = "ADMIN@x.com, ops@x.com";
    expect(isInternalEmail("admin@x.com")).toBe(true);
    expect(isInternalEmail("other@x.com")).toBe(false);
  });
});
