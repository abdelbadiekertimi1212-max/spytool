import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSubscriptionState } from "@/lib/supabase/subscription";
import type { Database } from "@/types/supabase";

type Sub = {
  status: string;
  package_tier: string;
  current_period_end: string | null;
} | null;

function client(user: { id: string } | null, sub: Sub): SupabaseClient<Database> {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: sub, error: null }) }),
      }),
    })),
  } as unknown as SupabaseClient<Database>;
}

const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 86_400_000).toISOString();

describe("getSubscriptionState", () => {
  it("inactive when there is no user", async () => {
    expect((await getSubscriptionState(client(null, null))).active).toBe(false);
  });

  it("active for a non-expired trial", async () => {
    const s = await getSubscriptionState(
      client({ id: "u1" }, { status: "trialing", package_tier: "free", current_period_end: future() })
    );
    expect(s.active).toBe(true);
    expect(s.tier).toBe("free");
  });

  it("active for an active sub with no end date", async () => {
    const s = await getSubscriptionState(
      client({ id: "u1" }, { status: "active", package_tier: "pro", current_period_end: null })
    );
    expect(s.active).toBe(true);
    expect(s.tier).toBe("pro");
  });

  it("inactive when the period has expired", async () => {
    const s = await getSubscriptionState(
      client({ id: "u1" }, { status: "active", package_tier: "pro", current_period_end: past() })
    );
    expect(s.active).toBe(false);
  });

  it("inactive when canceled or missing", async () => {
    expect(
      (await getSubscriptionState(
        client({ id: "u1" }, { status: "canceled", package_tier: "pro", current_period_end: null })
      )).active
    ).toBe(false);
    expect((await getSubscriptionState(client({ id: "u1" }, null))).active).toBe(false);
  });
});
