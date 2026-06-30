import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ getUser: vi.fn() }));

// Chainable query builder: every method returns the builder; awaiting it (or
// any terminal) resolves to a benign { error: null, count: 1 }.
function builder() {
  const result = { data: [], error: null, count: 1 };
  const chain: Record<string, unknown> = {};
  for (const m of ["update", "delete", "upsert", "insert", "select", "eq"]) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: h.getUser }, from: () => builder() }),
}));
vi.mock("@/lib/events/collector", () => ({ trackServer: vi.fn() }));

import { POST as onboardingPOST } from "@/app/api/onboarding/route";
import { POST as bookmarkPOST, DELETE as bookmarkDELETE } from "@/app/api/bookmarks/route";

function req(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("activation routes — auth + validation", () => {
  it("onboarding: 401 without a user", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await onboardingPOST(req({ country: "DZ" }))).status).toBe(401);
  });

  it("onboarding: 400 on invalid body", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    expect((await onboardingPOST(req({ experience_level: "wizard" }))).status).toBe(400);
  });

  it("onboarding: 200 on valid body", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const res = await onboardingPOST(
      req({ preferred_categories: ["Beauty & Cosmetics"], experience_level: "beginner", country: "DZ" })
    );
    expect(res.status).toBe(200);
  });

  it("bookmarks POST: 401 / 400 / 200", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await bookmarkPOST(req({ productId: "x" }))).status).toBe(401);

    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    expect((await bookmarkPOST(req({ productId: "not-a-uuid" }))).status).toBe(400);

    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ok = await bookmarkPOST(req({ productId: "11111111-1111-4111-8111-111111111111" }));
    expect(ok.status).toBe(200);
  });

  it("bookmarks DELETE: 401 then 200", async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await bookmarkDELETE(req({ productId: "x" }))).status).toBe(401);

    h.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const ok = await bookmarkDELETE(req({ productId: "11111111-1111-4111-8111-111111111111" }));
    expect(ok.status).toBe(200);
  });
});
