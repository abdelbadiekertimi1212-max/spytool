import { describe, it, expect } from "vitest";

import { computeVelocity } from "../lib/engine/winner";

/** Build a snapshot N days before a fixed epoch. */
const BASE = Date.parse("2026-06-20T00:00:00Z");
function snap(daysAgo: number, stock: number | null) {
  return { stock, captured_at: new Date(BASE - daysAgo * 86_400_000).toISOString() };
}

describe("computeVelocity (smart velocity)", () => {
  it("returns 0 with fewer than 2 known snapshots", () => {
    expect(computeVelocity([snap(0, 100)])).toEqual({ velocity: 0, soldUnits: 0 });
    expect(computeVelocity([])).toEqual({ velocity: 0, soldUnits: 0 });
  });

  it("computes units/day from a gradual 1-day drop", () => {
    // 100 → 90 over exactly one day = 10 units/day.
    const r = computeVelocity([snap(1, 100), snap(0, 90)]);
    expect(r.soldUnits).toBe(10);
    expect(r.velocity).toBeCloseTo(10, 5);
  });

  it("EXCLUDES a massive sudden drop (manual inventory reset)", () => {
    // 1000 → 0 in one day is >= maxSaleDrop(100): ignored, not a winner signal.
    const r = computeVelocity([snap(1, 1000), snap(0, 0)]);
    expect(r).toEqual({ velocity: 0, soldUnits: 0 });
  });

  it("EXCLUDES restocks (negative drops)", () => {
    const r = computeVelocity([snap(1, 50), snap(0, 80)]);
    expect(r).toEqual({ velocity: 0, soldUnits: 0 });
  });

  it("counts only valid intervals in a mixed series", () => {
    // d-4:100 → d-3:90 (10✓) → d-2:85 (5✓) → d-1:1085 (restock ✗) → d0:1080 (5✓)
    const r = computeVelocity([
      snap(4, 100),
      snap(3, 90),
      snap(2, 85),
      snap(1, 1085),
      snap(0, 1080),
    ]);
    expect(r.soldUnits).toBe(20);
    // 20 sold over 3 counted days.
    expect(r.velocity).toBeCloseTo(20 / 3, 4);
  });

  it("ignores null-stock snapshots", () => {
    const r = computeVelocity([snap(2, 100), snap(1, null), snap(0, 94)]);
    expect(r.soldUnits).toBe(6);
    expect(r.velocity).toBeCloseTo(3, 5); // 6 units over 2 days
  });
});
