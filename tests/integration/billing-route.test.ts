import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: h.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  }),
}));
vi.mock("@/lib/events/collector", () => ({ trackServer: vi.fn() }));

import { POST } from "@/app/api/billing/route";

function req(body: unknown) {
  return new Request("http://localhost/api/billing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("/api/billing", () => {
  it("401 without a user", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await POST(req({ action: "cancel" }))).status).toBe(401);
  });

  it("400 on invalid action", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    expect((await POST(req({ action: "explode" }))).status).toBe(400);
  });

  it("cancels at period end", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const res = await POST(req({ action: "cancel" }));
    expect(res.status).toBe(200);
    expect((await res.json()).cancel_at_period_end).toBe(true);
  });

  it("resumes", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const res = await POST(req({ action: "resume" }));
    expect((await res.json()).cancel_at_period_end).toBe(false);
  });
});
