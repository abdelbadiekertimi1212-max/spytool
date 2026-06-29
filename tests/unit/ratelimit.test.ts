import { describe, it, expect } from "vitest";

import { rateLimit } from "@/lib/ratelimit";

// No UPSTASH_* env in the test environment → the in-memory fallback is exercised.
describe("rateLimit (in-memory fallback)", () => {
  it("allows exactly the free-tier budget (10/min) then blocks", async () => {
    const key = `free-${Math.random()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 13; i += 1) {
      results.push((await rateLimit(key, "free")).success);
    }
    expect(results.filter(Boolean).length).toBe(10);
    expect(results[10]).toBe(false);
  });

  it("gives the pro tier far more headroom", async () => {
    const key = `pro-${Math.random()}`;
    let allowed = 0;
    for (let i = 0; i < 50; i += 1) {
      if ((await rateLimit(key, "pro")).success) allowed += 1;
    }
    expect(allowed).toBe(50); // pro budget is 120/min
  });

  it("keys are isolated from each other", async () => {
    const a = await rateLimit(`iso-a-${Math.random()}`, "free");
    const b = await rateLimit(`iso-b-${Math.random()}`, "free");
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });
});
