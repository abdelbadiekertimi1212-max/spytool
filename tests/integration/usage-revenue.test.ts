import { describe, it, expect } from "vitest";

import { getUsageSummary } from "@/lib/limits/usage";
import { getRevenueKpis } from "@/lib/analytics/revenue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function thenable(value: unknown): any {
  return { then: (res: (v: unknown) => unknown) => res(value) };
}

describe("getUsageSummary", () => {
  it("maps rules + counters into per-resource usage", async () => {
    const rules = [
      { plan: "starter", resource: "outreach_per_day", soft_limit: 1, hard_limit: 2, enabled: true },
    ];
    const counters = [{ metric: "outreach_per_day", window: "daily", value: 1, reset_at: null }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {
      from(table: string) {
        if (table === "limit_rules") {
          return { select: () => ({ eq: () => thenable({ data: rules, error: null }) }) };
        }
        return {
          select: () => ({ eq: () => ({ eq: () => thenable({ data: counters, error: null }) }) }),
        };
      },
    };

    const usage = await getUsageSummary(client, "u1", "starter");
    const outreach = usage.find((u) => u.resource === "outreach_per_day")!;
    expect(outreach.used).toBe(1);
    expect(outreach.hard).toBe(2);
    expect(outreach.remaining).toBe(1);
    expect(outreach.state).toBe("grace");
    // No rule for winners → unlimited.
    const winners = usage.find((u) => u.resource === "winners_per_day")!;
    expect(winners.hard).toBeNull();
    expect(winners.state).toBe("healthy");
  });
});

describe("getRevenueKpis", () => {
  it("derives KPIs from subscriptions + user count", async () => {
    const subs = [
      { status: "active", package_tier: "pro" },
      { status: "active", package_tier: "free" },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin: any = {
      from(table: string) {
        if (table === "subscriptions") {
          return { select: () => thenable({ data: subs, error: null }) };
        }
        return { select: () => thenable({ count: 5, error: null }) };
      },
    };
    const kpis = await getRevenueKpis(admin);
    expect(kpis.paying).toBe(1);
    expect(kpis.totalUsers).toBe(5);
    expect(kpis.mrr).toBeGreaterThan(0);
    expect(kpis.conversionPct).toBeCloseTo(20);
  });
});
