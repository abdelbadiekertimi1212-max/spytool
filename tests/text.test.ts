import { describe, it, expect } from "vitest";

import { normalizeTitle } from "../lib/engine/text";

describe("normalizeTitle", () => {
  it("lowercases and strips ASCII punctuation", () => {
    expect(normalizeTitle("Robe Soirée Malak!")).toBe("robe soirée malak");
    expect(normalizeTitle("Pack-2024 (NEW)")).toBe("pack 2024 new");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeTitle("  Multi   Space  ")).toBe("multi space");
  });

  it("preserves Arabic letters (does not use \\w)", () => {
    expect(normalizeTitle("فستان جميل")).toBe("فستان جميل");
    expect(normalizeTitle("ساعة، ذكية")).toBe("ساعة ذكية"); // Arabic comma stripped
  });

  it("groups the same product written by different stores", () => {
    expect(normalizeTitle("Montre Smart - 2024!")).toBe(
      normalizeTitle("montre smart 2024")
    );
  });
});
