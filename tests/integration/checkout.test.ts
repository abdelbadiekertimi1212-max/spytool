import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rateLimit: vi.fn(),
  createCheckout: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: h.getUser } }),
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: h.rateLimit }));
vi.mock("@/lib/chargily", () => ({ createCheckout: h.createCheckout }));

import { POST } from "@/app/api/checkout/route";

function post(body: unknown) {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.getUser.mockReset();
  h.rateLimit.mockReset();
  h.createCheckout.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  h.rateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9 });
  h.createCheckout.mockResolvedValue({ id: "co_1", checkout_url: "https://pay.test/x" });
});

describe("POST /api/checkout", () => {
  it("401 when unauthenticated", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(post({ tier: "pro" }))).status).toBe(401);
  });

  it("429 when rate limited", async () => {
    h.rateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0 });
    expect((await POST(post({ tier: "pro" }))).status).toBe(429);
    expect(h.createCheckout).not.toHaveBeenCalled();
  });

  it("400 on invalid tier (free / unknown)", async () => {
    expect((await POST(post({ tier: "free" }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
  });

  it("200 with checkout_url on success", async () => {
    const res = await POST(post({ tier: "pro" }));
    expect(res.status).toBe(200);
    expect((await res.json()).checkout_url).toBe("https://pay.test/x");
    expect(h.createCheckout).toHaveBeenCalledTimes(1);
  });
});
