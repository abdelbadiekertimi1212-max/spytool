import { describe, it, expect, vi, beforeEach } from "vitest";

describe("classifyBatch", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GROQ_API_KEY;
  });

  it("returns [] for empty input", async () => {
    const { classifyBatch } = await import("@/lib/engine/classifier");
    expect(await classifyBatch([])).toEqual([]);
  });

  it("returns Uncategorized for all items when Groq is not configured", async () => {
    const { classifyBatch } = await import("@/lib/engine/classifier");
    const r = await classifyBatch([{ title: "X" }, { title: "Y" }]);
    expect(r).toEqual(["Uncategorized", "Uncategorized"]);
  });

  it("parses Groq output and coerces off-taxonomy labels to Uncategorized", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.doMock("groq-sdk", () => ({
      default: class {
        chat = {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      results: [
                        { i: 0, niche: "Beauty & Cosmetics" },
                        { i: 1, niche: "TOTALLY MADE UP" },
                      ],
                    }),
                  },
                },
              ],
            }),
          },
        };
      },
    }));
    const { classifyBatch } = await import("@/lib/engine/classifier");
    const r = await classifyBatch([{ title: "Lipstick" }, { title: "???" }]);
    expect(r[0]).toBe("Beauty & Cosmetics");
    expect(r[1]).toBe("Uncategorized");
  });
});

describe("NICHES taxonomy", () => {
  it("includes the Uncategorized fallback", async () => {
    const { NICHES } = await import("@/lib/engine/classifier");
    expect(NICHES).toContain("Uncategorized");
    expect(NICHES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("classifier backfill (no Groq configured)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GROQ_API_KEY;
  });

  it("tagProductsByNiche tags nothing without Groq", async () => {
    const { tagProductsByNiche } = await import("@/lib/engine/classifier");
    const { createSupabaseMock } = await import("../mocks/supabase");
    const client = createSupabaseMock() as never;
    expect(await tagProductsByNiche(client, [{ id: "p1", title: "X" }])).toBe(0);
  });

  it("classifyAll drains to 0 without Groq (no infinite loop)", async () => {
    const { classifyAll } = await import("@/lib/engine/classifier");
    const { createSupabaseMock } = await import("../mocks/supabase");
    const client = createSupabaseMock({
      tables: { products: { data: [{ id: "p1", title: "X", description: null }], error: null } },
    }) as never;
    expect(await classifyAll(client, { chunkSize: 5, delayMs: 0 })).toBe(0);
  });
});
