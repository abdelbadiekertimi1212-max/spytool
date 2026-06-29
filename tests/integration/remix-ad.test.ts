import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: h.getUser } }),
}));

import { POST } from "@/app/api/remix-ad/route";

beforeEach(() => h.getUser.mockReset());

describe("POST /api/remix-ad (scaffold)", () => {
  it("401 when unauthenticated", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST()).status).toBe(401);
  });
  it("501 Not Implemented when authenticated", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect((await POST()).status).toBe(501);
  });
});
