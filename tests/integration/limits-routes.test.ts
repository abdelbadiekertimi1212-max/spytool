import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  enforceLimit: vi.fn(),
  recordUsage: vi.fn(async () => undefined),
  inRollout: vi.fn(() => true),
  generateOutreach: vi.fn(async () => ({ subject: "s", body: "b", callHook: "c" })),
}));

function builder(table: string) {
  const b: Record<string, unknown> = {};
  const store = { id: "s1", name: "S", url: "https://s.dz", platform: "shopify", lead_score: 10 };
  for (const m of ["select", "eq", "order", "limit", "upsert", "delete", "insert"]) {
    b[m] = () => b;
  }
  b.single = async () =>
    table === "stores" ? { data: store, error: null } : { data: null, error: null };
  b.maybeSingle = async () =>
    table === "subscriptions" ? { data: { package_tier: "starter" } } : { data: null };
  (b as { then: unknown }).then = (res: (v: unknown) => unknown) =>
    res({ data: [], error: null, count: 1 });
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: h.getUser }, from: (t: string) => builder(t) }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/limits/rollout", () => ({ inRollout: h.inRollout }));
vi.mock("@/lib/limits/enforce", () => ({
  enforceLimit: h.enforceLimit,
  recordUsage: h.recordUsage,
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn(async () => ({ success: true, limit: 9, remaining: 9 })) }));
vi.mock("@/lib/groq", () => ({ generateOutreach: h.generateOutreach }));
vi.mock("@/lib/events/collector", () => ({ trackServer: vi.fn() }));

import { POST as outreachPOST } from "@/app/api/outreach/route";
import { POST as bookmarkPOST } from "@/app/api/bookmarks/route";

const blocked = {
  allowed: false,
  enforced: true,
  decision: { allowed: false, value: 2, soft: 1, hard: 2, nearSoft: true },
  headers: { "X-Usage-Limit": "2", "X-Usage-Remaining": "0", "X-Usage-Used": "2" },
};
const okNearSoft = {
  allowed: true,
  enforced: true,
  decision: { allowed: true, value: 1, soft: 1, hard: 2, nearSoft: true },
  headers: { "X-Usage-Limit": "2", "X-Usage-Remaining": "1", "X-Usage-Used": "1" },
};

function req(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const UUID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  h.inRollout.mockReturnValue(true);
});

describe("usage limits — outreach route", () => {
  it("returns 429 with usage headers when over the hard limit", async () => {
    h.enforceLimit.mockResolvedValueOnce(blocked);
    const res = await outreachPOST(req({ storeId: UUID }));
    expect(res.status).toBe(429);
    expect(res.headers.get("X-Usage-Remaining")).toBe("0");
    const body = await res.json();
    expect(body.upgrade).toBe(true);
  });

  it("allows within grace and records usage", async () => {
    h.enforceLimit.mockResolvedValueOnce(okNearSoft);
    const res = await outreachPOST(req({ storeId: UUID }));
    expect(res.status).toBe(200);
    expect(h.recordUsage).toHaveBeenCalledWith(expect.anything(), "u1", "outreach_per_day");
  });
});

describe("usage limits — bookmarks route", () => {
  it("returns 429 when the daily bookmark limit is hit", async () => {
    h.enforceLimit.mockResolvedValueOnce(blocked);
    const res = await bookmarkPOST(req({ productId: UUID }));
    expect(res.status).toBe(429);
  });

  it("saves and records usage within the limit", async () => {
    h.enforceLimit.mockResolvedValueOnce(okNearSoft);
    const res = await bookmarkPOST(req({ productId: UUID }));
    expect(res.status).toBe(200);
    expect(h.recordUsage).toHaveBeenCalledWith(expect.anything(), "u1", "bookmarks_per_day");
  });
});
