import { describe, it, expect } from "vitest";

import { decide, resolveLimit, type LimitRule } from "@/lib/limits/policy";

const rule = (over: Partial<LimitRule> = {}): LimitRule => ({
  plan: "starter",
  resource: "outreach_per_day",
  soft_limit: 20,
  hard_limit: 30,
  enabled: true,
  ...over,
});

describe("limits policy", () => {
  it("resolveLimit matches plan + resource", () => {
    const rules = [rule(), rule({ plan: "pro", hard_limit: 150 })];
    expect(resolveLimit(rules, "pro", "outreach_per_day")?.hard_limit).toBe(150);
    expect(resolveLimit(rules, "agency", "outreach_per_day")).toBeNull();
  });

  it("allows when no rule or disabled", () => {
    expect(decide(999, null).allowed).toBe(true);
    expect(decide(999, rule({ enabled: false })).allowed).toBe(true);
  });

  it("allows below the hard limit", () => {
    const d = decide(10, rule());
    expect(d.allowed).toBe(true);
    expect(d.nearSoft).toBe(false);
  });

  it("flags nearSoft at/after the soft limit but still allows", () => {
    const d = decide(25, rule());
    expect(d.allowed).toBe(true);
    expect(d.nearSoft).toBe(true);
  });

  it("blocks at/after the hard limit", () => {
    expect(decide(30, rule()).allowed).toBe(false);
    expect(decide(31, rule()).allowed).toBe(false);
  });
});
