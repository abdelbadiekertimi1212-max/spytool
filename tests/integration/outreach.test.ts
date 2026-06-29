import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rateLimit: vi.fn(),
  generateOutreach: vi.fn(),
}));

vi.mock("@/lib/supabase/server", async () => {
  const { createSupabaseMock } = await import("../mocks/supabase");
  return {
    createClient: () => {
      const c = createSupabaseMock({
        user: { id: "u1" },
        tables: {
          subscriptions: { data: { package_tier: "pro" } },
          stores: {
            data: {
              id: "s1",
              url: "https://store.dz",
              name: "Store DZ",
              platform: "shopify",
              lead_score: 50,
            },
          },
          products: { data: null, count: 0 },
        },
      });
      c.auth.getUser = h.getUser;
      return c;
    },
  };
});
vi.mock("@/lib/ratelimit", () => ({ rateLimit: h.rateLimit }));
vi.mock("@/lib/groq", () => ({ generateOutreach: h.generateOutreach }));

import { POST } from "@/app/api/outreach/route";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

function post(body: unknown) {
  return new Request("http://localhost/api/outreach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.getUser.mockReset();
  h.rateLimit.mockReset();
  h.generateOutreach.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  h.rateLimit.mockResolvedValue({ success: true, limit: 120, remaining: 119 });
  h.generateOutreach.mockResolvedValue({
    subject: "Quick idea",
    body: "Body text",
    callHook: "Hook",
  });
});

describe("POST /api/outreach", () => {
  it("401 when unauthenticated", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(post({ storeId: UUID }))).status).toBe(401);
  });

  it("429 when rate limited", async () => {
    h.rateLimit.mockResolvedValue({ success: false, limit: 120, remaining: 0 });
    expect((await POST(post({ storeId: UUID }))).status).toBe(429);
    expect(h.generateOutreach).not.toHaveBeenCalled();
  });

  it("400 on invalid body (non-uuid storeId)", async () => {
    expect((await POST(post({ storeId: "bad" }))).status).toBe(400);
  });

  it("200 with generated copy on success", async () => {
    const res = await POST(post({ storeId: UUID, locale: "en" }));
    expect(res.status).toBe(200);
    expect((await res.json()).subject).toBe("Quick idea");
    expect(h.generateOutreach).toHaveBeenCalledTimes(1);
  });
});
