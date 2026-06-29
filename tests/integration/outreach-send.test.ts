import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  rateLimit: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: h.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { package_tier: "free" } }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: h.rateLimit }));
vi.mock("@/lib/resend", () => ({ sendOutreachEmail: h.send }));

import { POST } from "@/app/api/outreach/send/route";

function post(body: unknown) {
  return new Request("http://localhost/api/outreach/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.getUser.mockReset();
  h.rateLimit.mockReset();
  h.send.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  h.rateLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9 });
  h.send.mockResolvedValue({ id: "email_1" });
});

describe("POST /api/outreach/send", () => {
  it("401 when unauthenticated", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(post({ to: "a@b.com", subject: "S", text: "T" }))).status).toBe(401);
  });
  it("429 when rate limited", async () => {
    h.rateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0 });
    expect((await POST(post({ to: "a@b.com", subject: "S", text: "T" }))).status).toBe(429);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("400 on invalid email", async () => {
    expect((await POST(post({ to: "bad", subject: "S", text: "T" }))).status).toBe(400);
  });
  it("200 and sends on valid payload", async () => {
    const res = await POST(post({ to: "a@b.com", subject: "S", text: "T" }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("email_1");
    expect(h.send).toHaveBeenCalledTimes(1);
  });
});
