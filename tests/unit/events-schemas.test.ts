import { describe, it, expect } from "vitest";

import { validateEvent, EVENT_NAMES } from "@/lib/events/schemas";

describe("validateEvent", () => {
  it("accepts a known event with properties", () => {
    const ev = validateEvent({
      event_name: "checkout",
      user_id: "11111111-1111-4111-8111-111111111111",
      properties: { tier: "pro" },
    });
    expect(ev).not.toBeNull();
    expect(ev?.event_name).toBe("checkout");
  });

  it("accepts an anonymous event (no user_id)", () => {
    const ev = validateEvent({ event_name: "dashboard_view", anonymous_id: "anon-1" });
    expect(ev?.anonymous_id).toBe("anon-1");
  });

  it("rejects unknown event names", () => {
    expect(validateEvent({ event_name: "hack_attempt" })).toBeNull();
  });

  it("rejects malformed user_id", () => {
    expect(validateEvent({ event_name: "login", user_id: "not-a-uuid" })).toBeNull();
  });

  it("covers the full taxonomy", () => {
    expect(EVENT_NAMES).toContain("queue_failure");
    expect(EVENT_NAMES).toContain("image_rehost");
    expect(EVENT_NAMES).toContain("onboarding_completed");
    expect(EVENT_NAMES).toContain("first_bookmark");
    expect(EVENT_NAMES.length).toBe(14);
  });
});
