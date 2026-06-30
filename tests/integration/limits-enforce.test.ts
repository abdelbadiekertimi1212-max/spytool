import { describe, it, expect, afterEach } from "vitest";

import { enforceLimit, usageHeaders, recordUsage } from "@/lib/limits/enforce";
import type { LimitDecision } from "@/lib/limits/policy";

const ENABLED = process.env.ENABLE_USAGE_LIMITS;
const ROLLOUT = process.env.LIMITS_ROLLOUT;
afterEach(() => {
  process.env.ENABLE_USAGE_LIMITS = ENABLED;
  process.env.LIMITS_ROLLOUT = ROLLOUT;
});

type Rule = { plan: string; resource: string; soft_limit: number; hard_limit: number; enabled: boolean };

// Minimal chainable Supabase mock for checkLimit + increment RPC.
function mockClient(rule: Rule | null, counterValue: number | null) {
  return {
    from(table: string) {
      if (table === "limit_rules") {
        const b = {
          select: () => b,
          eq: () => b,
          then: (res: (v: unknown) => unknown) => res({ data: rule ? [rule] : [], error: null }),
        };
        return b;
      }
      const c = {
        select: () => c,
        eq: () => c,
        maybeSingle: async () => ({
          data: counterValue === null ? null : { value: counterValue, reset_at: null },
          error: null,
        }),
      };
      return c;
    },
    rpc: async () => ({ data: 1, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const rule: Rule = {
  plan: "starter",
  resource: "outreach_per_day",
  soft_limit: 1,
  hard_limit: 2,
  enabled: true,
};

describe("usageHeaders", () => {
  it("emits limit/used/remaining when a hard limit exists", () => {
    const d: LimitDecision = { allowed: true, value: 1, soft: 1, hard: 2, nearSoft: true };
    expect(usageHeaders(d)).toEqual({
      "X-Usage-Limit": "2",
      "X-Usage-Used": "1",
      "X-Usage-Remaining": "1",
    });
  });
  it("is empty with no hard limit", () => {
    expect(usageHeaders({ allowed: true, value: 0, soft: null, hard: null, nearSoft: false })).toEqual({});
  });
});

describe("enforceLimit", () => {
  it("does nothing when the user is not in the rollout", async () => {
    process.env.ENABLE_USAGE_LIMITS = "false";
    const r = await enforceLimit(mockClient(rule, 5), "u1", "starter", "outreach_per_day");
    expect(r.enforced).toBe(false);
    expect(r.allowed).toBe(true);
  });

  it("allows within the grace band and blocks past the hard limit", async () => {
    process.env.ENABLE_USAGE_LIMITS = "true";
    process.env.LIMITS_ROLLOUT = "100";

    const within = await enforceLimit(mockClient(rule, 1), "u1", "starter", "outreach_per_day");
    expect(within.enforced).toBe(true);
    expect(within.allowed).toBe(true);
    expect(within.decision.nearSoft).toBe(true);

    const over = await enforceLimit(mockClient(rule, 2), "u1", "starter", "outreach_per_day");
    expect(over.allowed).toBe(false);
  });

  it("recordUsage calls the RPC without throwing", async () => {
    await expect(recordUsage(mockClient(rule, 0), "u1", "outreach_per_day")).resolves.toBeUndefined();
  });
});
