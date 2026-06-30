import { describe, it, expect } from "vitest";

import { computeActivation } from "@/lib/activation/score";

describe("computeActivation", () => {
  it("scores zero for a brand-new user", () => {
    const s = computeActivation({ onboardingCompleted: false, bookmarkCount: 0, isPaid: false });
    expect(s.score).toBe(0);
    expect(s.activated).toBe(false);
  });

  it("onboarding alone is not activated (no value retained yet)", () => {
    const s = computeActivation({ onboardingCompleted: true, bookmarkCount: 0, isPaid: false });
    expect(s.score).toBe(40);
    expect(s.activated).toBe(false);
  });

  it("activated = onboarded AND a saved winner", () => {
    const s = computeActivation({ onboardingCompleted: true, bookmarkCount: 2, isPaid: false });
    expect(s.score).toBe(75);
    expect(s.activated).toBe(true);
  });

  it("full score for a paying, engaged user", () => {
    const s = computeActivation({ onboardingCompleted: true, bookmarkCount: 5, isPaid: true });
    expect(s.score).toBe(100);
    expect(s.activated).toBe(true);
    expect(s.milestones.every((m) => m.done)).toBe(true);
  });
});
