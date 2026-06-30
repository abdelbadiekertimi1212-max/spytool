import { describe, it, expect } from "vitest";

import { sha256 } from "@/lib/media/hash";

describe("sha256", () => {
  it("is deterministic and 64 hex chars", () => {
    const a = sha256(Buffer.from("winner-radar"));
    const b = sha256(Buffer.from("winner-radar"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different content (dedup correctness)", () => {
    expect(sha256(Buffer.from("a"))).not.toBe(sha256(Buffer.from("b")));
  });
});
