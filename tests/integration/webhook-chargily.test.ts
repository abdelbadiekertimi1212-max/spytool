import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  verify: vi.fn(),
  dedupe: { data: [{ event_id: "evt_1" }] as unknown[], error: null as unknown },
  updateSpy: vi.fn(async (_vals: unknown) => ({ error: null })),
}));

vi.mock("@/lib/chargily", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/chargily");
  return { ...actual, verifyWebhookSignature: h.verify };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "processed_webhook_events") {
        return { upsert: () => ({ select: async () => h.dedupe }) };
      }
      if (table === "subscriptions") {
        return { update: (vals: unknown) => ({ eq: () => h.updateSpy(vals) }) };
      }
      return {};
    },
  }),
}));

import { POST } from "@/app/api/webhooks/chargily/route";

function post(event: unknown, signature = "sig") {
  return new Request("http://localhost/api/webhooks/chargily", {
    method: "POST",
    headers: { signature },
    body: JSON.stringify(event),
  });
}

const paidEvent = {
  id: "evt_1",
  type: "checkout.paid",
  data: { id: "co_1", status: "paid", metadata: [{ user_id: "u1", tier: "pro" }] },
};

beforeEach(() => {
  h.verify.mockReset();
  h.updateSpy.mockClear();
  h.verify.mockReturnValue(true);
  h.dedupe = { data: [{ event_id: "evt_1" }], error: null };
});

describe("POST /api/webhooks/chargily", () => {
  it("403 on invalid signature", async () => {
    h.verify.mockReturnValue(false);
    expect((await post(paidEvent)).headers).toBeDefined();
    const res = await POST(post(paidEvent));
    expect(res.status).toBe(403);
    expect(h.updateSpy).not.toHaveBeenCalled();
  });

  it("400 on a malformed event", async () => {
    const res = await POST(post({ foo: "bar" }));
    expect(res.status).toBe(400);
  });

  it("acks duplicates without re-applying (replay protection)", async () => {
    h.dedupe = { data: [], error: null }; // conflict → already processed
    const res = await POST(post(paidEvent));
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(h.updateSpy).not.toHaveBeenCalled();
  });

  it("upgrades the subscription on a new checkout.paid event", async () => {
    const res = await POST(post(paidEvent));
    expect(res.status).toBe(200);
    expect(h.updateSpy).toHaveBeenCalledTimes(1);
    const vals = h.updateSpy.mock.calls[0][0] as { status: string; package_tier: string };
    expect(vals.status).toBe("active");
    expect(vals.package_tier).toBe("pro");
  });
});
