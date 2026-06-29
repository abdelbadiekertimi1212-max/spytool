import { describe, it, expect } from "vitest";

import {
  checkoutSchema,
  outreachSchema,
  outreachSendSchema,
  parseBody,
} from "@/lib/validation";

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("checkoutSchema", () => {
  it("accepts paid tiers and optional valid locale", () => {
    expect(checkoutSchema.safeParse({ tier: "pro" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ tier: "agency", locale: "ar" }).success).toBe(true);
  });
  it("rejects free, unknown tiers, and bad locales", () => {
    expect(checkoutSchema.safeParse({ tier: "free" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ tier: "x" }).success).toBe(false);
    expect(checkoutSchema.safeParse({}).success).toBe(false);
    expect(checkoutSchema.safeParse({ tier: "pro", locale: "de" }).success).toBe(false);
  });
});

describe("outreachSchema", () => {
  it("requires a uuid storeId", () => {
    expect(
      outreachSchema.safeParse({ storeId: "550e8400-e29b-41d4-a716-446655440000" }).success
    ).toBe(true);
    expect(outreachSchema.safeParse({ storeId: "nope" }).success).toBe(false);
    expect(outreachSchema.safeParse({}).success).toBe(false);
  });
});

describe("outreachSendSchema", () => {
  it("validates email and non-empty subject/text", () => {
    expect(
      outreachSendSchema.safeParse({ to: "a@b.com", subject: "Hi", text: "Body" }).success
    ).toBe(true);
    expect(
      outreachSendSchema.safeParse({ to: "bad", subject: "Hi", text: "Body" }).success
    ).toBe(false);
    expect(
      outreachSendSchema.safeParse({ to: "a@b.com", subject: "", text: "Body" }).success
    ).toBe(false);
  });
});

describe("parseBody", () => {
  it("returns parsed data for a valid body", async () => {
    expect(await parseBody(jsonReq({ tier: "pro" }), checkoutSchema)).toEqual({ tier: "pro" });
  });
  it("returns null for an invalid body", async () => {
    expect(await parseBody(jsonReq({ tier: "free" }), checkoutSchema)).toBeNull();
  });
  it("returns null for malformed JSON", async () => {
    const bad = new Request("http://localhost/api/x", { method: "POST", body: "{nope" });
    expect(await parseBody(bad, checkoutSchema)).toBeNull();
  });
});
