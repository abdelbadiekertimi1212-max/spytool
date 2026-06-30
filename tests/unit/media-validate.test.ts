import { describe, it, expect } from "vitest";

import { isAllowedMime, isAllowedSize, normalizeMime } from "@/lib/media/validate";

describe("media validation", () => {
  it("accepts raster image mimes", () => {
    for (const m of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
      expect(isAllowedMime(m)).toBe(true);
    }
  });

  it("rejects svg, html, xml and empty", () => {
    expect(isAllowedMime("image/svg+xml")).toBe(false);
    expect(isAllowedMime("text/html")).toBe(false);
    expect(isAllowedMime("application/xml")).toBe(false);
    expect(isAllowedMime(null)).toBe(false);
    expect(isAllowedMime("")).toBe(false);
  });

  it("normalizes content-type params", () => {
    expect(normalizeMime("image/png; charset=binary")).toBe("image/png");
    expect(isAllowedMime("IMAGE/PNG; x=y")).toBe(true);
  });

  it("enforces size bounds", () => {
    expect(isAllowedSize(50)).toBe(false); // too small / corrupt
    expect(isAllowedSize(5000)).toBe(true);
    expect(isAllowedSize(9_000_000)).toBe(false); // over 8MB cap
  });
});
