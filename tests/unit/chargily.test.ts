import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

beforeEach(() => {
  process.env.CHARGILY_SECRET_KEY = "test_secret";
  process.env.CHARGILY_MODE = "test";
});

import {
  verifyWebhookSignature,
  readMetadata,
  createCheckout,
} from "@/lib/chargily";

describe("verifyWebhookSignature", () => {
  it("accepts a correct HMAC-SHA256 and rejects tampering", () => {
    const body = JSON.stringify({ id: "evt_1", type: "checkout.paid" });
    const good = crypto
      .createHmac("sha256", "test_secret")
      .update(body, "utf8")
      .digest("hex");
    expect(verifyWebhookSignature(body, good)).toBe(true);
    expect(verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
    expect(verifyWebhookSignature("tampered", good)).toBe(false);
  });
});

describe("readMetadata", () => {
  it("normalizes array and object metadata, defaults to {}", () => {
    expect(readMetadata({ id: "x", metadata: [{ user_id: "u1" }] })).toEqual({
      user_id: "u1",
    });
    expect(readMetadata({ id: "x", metadata: { tier: "pro" } })).toEqual({
      tier: "pro",
    });
    expect(readMetadata({ id: "x" })).toEqual({});
  });
});

describe("createCheckout", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the hosted checkout url on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ id: "co_1", checkout_url: "https://pay.test/x" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );
    const r = await createCheckout({ amount: 1500, successUrl: "https://s" });
    expect(r.checkout_url).toBe("https://pay.test/x");
    expect(r.id).toBe("co_1");
  });

  it("throws on a non-OK API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "bad request" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
      )
    );
    await expect(createCheckout({ amount: 1500, successUrl: "https://s" })).rejects.toThrow();
  });
});
