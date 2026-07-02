import { describe, it, expect } from "vitest";

import { usageState } from "@/lib/limits/usage";

describe("usageState", () => {
  it("is healthy when unlimited (no hard cap)", () => {
    expect(usageState(999, null, null)).toBe("healthy");
  });
  it("is healthy below 80% of soft", () => {
    expect(usageState(5, 10, 12)).toBe("healthy");
  });
  it("is near at >=80% of soft", () => {
    expect(usageState(8, 10, 12)).toBe("near");
  });
  it("is grace from soft up to hard", () => {
    expect(usageState(10, 10, 12)).toBe("grace");
    expect(usageState(11, 10, 12)).toBe("grace");
  });
  it("is reached at/over the hard limit", () => {
    expect(usageState(12, 10, 12)).toBe("reached");
    expect(usageState(20, 10, 12)).toBe("reached");
  });
});
