import { describe, it, expect } from "vitest";

import { summarizeRuns } from "@/lib/queue/metrics";

describe("summarizeRuns", () => {
  it("aggregates runs per job with latest status, avg duration and counts", () => {
    const rows = [
      { job_name: "inventory", status: "completed", duration_ms: 1000, created_at: "2026-06-29T10:00:00Z" },
      { job_name: "inventory", status: "failed", duration_ms: 2000, created_at: "2026-06-29T11:00:00Z" },
      { job_name: "inventory", status: "active", duration_ms: null, created_at: "2026-06-29T12:00:00Z" },
      { job_name: "winners", status: "completed", duration_ms: 500, created_at: "2026-06-29T09:00:00Z" },
    ];
    const out = summarizeRuns(rows);
    const inv = out.find((s) => s.job === "inventory")!;
    const win = out.find((s) => s.job === "winners")!;

    expect(inv.runs).toBe(3);
    expect(inv.failures).toBe(1);
    expect(inv.active).toBe(1);
    expect(inv.lastStatus).toBe("active"); // latest by created_at
    expect(inv.avgDurationMs).toBe(1500); // (1000+2000)/2, nulls ignored
    expect(win.runs).toBe(1);
    expect(win.avgDurationMs).toBe(500);
  });

  it("returns an empty array for no runs", () => {
    expect(summarizeRuns([])).toEqual([]);
  });
});
