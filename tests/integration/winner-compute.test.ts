import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { computeWinners } from "@/lib/engine/winner";
import { createSupabaseMock } from "../mocks/supabase";
import type { Database } from "@/types/supabase";

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString();

describe("computeWinners — 3D verification", () => {
  it("flags a product with valid velocity AND ad commitment", async () => {
    const client = createSupabaseMock({
      tables: {
        // store s1: 2 distinct creatives, oldest started 5 days ago (> 3d).
        ads: {
          data: [
            { store_id: "s1", start_date: iso(5), ad_creative_url: "a", meta_ad_id: "a" },
            { store_id: "s1", start_date: iso(5), ad_creative_url: "b", meta_ad_id: "b" },
          ],
          error: null,
        },
        products: {
          data: [
            { id: "p1", store_id: "s1", title: "Winner Product", is_winner: false, winner_since: null },
            { id: "p2", store_id: "s2", title: "No Ads Product", is_winner: false, winner_since: null },
          ],
          error: null,
        },
        // p1 depletes 10/day (gradual → counts); p2 has no snapshots.
        product_snapshots: {
          data: [
            { product_id: "p1", stock: 100, captured_at: iso(3) },
            { product_id: "p1", stock: 90, captured_at: iso(2) },
            { product_id: "p1", stock: 80, captured_at: iso(1) },
            { product_id: "p1", stock: 70, captured_at: iso(0) },
          ],
          error: null,
        },
        stores: { data: null, error: null },
      },
    }) as unknown as SupabaseClient<Database>;

    const res = await computeWinners(client);
    expect(res.processed).toBe(2);
    expect(res.winners).toBe(1);
  });

  it("does NOT flag a fast mover whose store has no ad commitment", async () => {
    const client = createSupabaseMock({
      tables: {
        ads: { data: [], error: null }, // no active ads → axis 2 fails
        products: {
          data: [
            { id: "p1", store_id: "s1", title: "Fast Mover", is_winner: false, winner_since: null },
          ],
          error: null,
        },
        product_snapshots: {
          data: [
            { product_id: "p1", stock: 90, captured_at: iso(2) },
            { product_id: "p1", stock: 40, captured_at: iso(0) }, // 50 over 2d = 25/day
          ],
          error: null,
        },
        stores: { data: null, error: null },
      },
    }) as unknown as SupabaseClient<Database>;

    const res = await computeWinners(client);
    expect(res.winners).toBe(0);
  });
});
