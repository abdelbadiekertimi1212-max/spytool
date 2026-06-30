import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the network + image + storage boundaries; the orchestrator logic is real.
vi.mock("@/lib/media/download", () => ({
  downloadImage: vi.fn(async () => ({
    buffer: Buffer.from("fake-bytes"),
    mime: "image/jpeg",
    bytes: 1000,
  })),
}));
vi.mock("@/lib/media/transform", () => ({
  transformImage: vi.fn(async () => ({
    width: 2000,
    height: 2000,
    variants: [
      { name: "thumb", buffer: Buffer.from("t"), width: 300, height: 300 },
      { name: "card", buffer: Buffer.from("c"), width: 800, height: 800 },
      { name: "full", buffer: Buffer.from("f"), width: 1600, height: 1600 },
    ],
  })),
}));
vi.mock("@/lib/media/upload", () => ({
  uploadVariant: vi.fn(async () => "https://cdn.example/card.webp"),
  publicUrl: vi.fn(() => "https://cdn.example/existing.webp"),
}));

import { ingestProductImage } from "@/lib/media";

type Existing = { storage_path: string } | null;

function fakeClient(existing: Existing) {
  const inserts: { table: string; value: unknown }[] = [];
  const updates: { table: string; value: unknown }[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: existing, error: null };
        },
        update(value: unknown) {
          updates.push({ table, value });
          return { eq: async () => ({ error: null }) };
        },
        insert(value: unknown) {
          inserts.push({ table, value });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, inserts, updates };
}

beforeEach(() => vi.clearAllMocks());

describe("ingestProductImage", () => {
  it("dedupes when an asset with the same hash exists (no upload/insert)", async () => {
    const { client, inserts } = fakeClient({ storage_path: "products/x/card.webp" });
    const r = await ingestProductImage(client, "prod-1", "https://ext/img.jpg");
    expect(r.status).toBe("deduped");
    expect(r.url).toBe("https://cdn.example/existing.webp");
    expect(inserts).toHaveLength(0); // reused — nothing written to media_assets
  });

  it("rehosts a new image: uploads, records the asset, sets the product URL", async () => {
    const { client, inserts, updates } = fakeClient(null);
    const r = await ingestProductImage(client, "prod-2", "https://ext/new.jpg");
    expect(r.status).toBe("rehosted");
    expect(r.url).toBe("https://cdn.example/card.webp");
    expect(inserts.some((i) => i.table === "media_assets")).toBe(true);
    expect(updates.some((u) => u.table === "products")).toBe(true);
  });
});
