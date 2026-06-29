import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";

/**
 * Deterministic, isolated, re-runnable E2E environment.
 *  - Provisions three auth users (active subscriber / expired / admin) via the
 *    Auth admin API and sets their subscription state.
 *  - Seeds the public catalog fixtures (mirrors supabase/seed-test.sql).
 * Isolated by the "@e2e.test" email domain + "E2E —" / fixed-UUID markers, so it
 * never collides with real data and can run in parallel CI shards.
 */

export const E2E_PASSWORD = "E2eTest!2026";

export const E2E_USERS = {
  subscriber: { email: "subscriber@e2e.test", status: "active", tier: "pro", expired: false },
  expired: { email: "expired@e2e.test", status: "canceled", tier: "free", expired: true },
  admin: { email: "admin@e2e.test", status: "active", tier: "agency", expired: false },
} as const;

const STORE_ID = "e2e00000-0000-4000-a000-000000000001";
const WINNER_ID = "e2e00000-0000-4000-b000-000000000001";
const TRACK_ID = "e2e00000-0000-4000-b000-000000000002";

type Client = ReturnType<typeof createEngineClient>;

async function ensureUser(client: Client, email: string): Promise<string> {
  const { data: list, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    await client.auth.admin.updateUserById(existing.id, {
      password: E2E_PASSWORD,
      email_confirm: true,
    });
    return existing.id;
  }
  const { data, error: createErr } = await client.auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !data.user) throw new Error(`createUser: ${createErr?.message}`);
  return data.user.id;
}

async function setSubscription(
  client: Client,
  userId: string,
  status: string,
  tier: string,
  expired: boolean
) {
  const now = Date.now();
  const periodEnd = new Date(now + (expired ? -86_400_000 : 30 * 86_400_000)).toISOString();
  const { error } = await client.from("subscriptions").upsert(
    {
      user_id: userId,
      status: status as never,
      package_tier: tier as never,
      current_period_start: new Date(now - 86_400_000).toISOString(),
      current_period_end: periodEnd,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`subscription upsert: ${error.message}`);
}

async function seedCatalog(client: Client) {
  await client.from("stores").upsert(
    {
      id: STORE_ID,
      url: "https://e2e-winner-store.test",
      domain: "e2e-winner-store.test",
      name: "E2E — Winner Store",
      platform: "shopify" as never,
      fb_page_name: "E2E Winner Store",
      country: "DZ",
      lead_score: 88,
      is_active: true,
      last_scraped_at: new Date().toISOString(),
      ads_checked_at: new Date().toISOString(),
    },
    { onConflict: "url" }
  );

  await client.from("products").upsert(
    [
      {
        id: WINNER_ID,
        store_id: STORE_ID,
        external_id: "e2e-winner-1",
        title: "E2E — Smart Watch DZ",
        niche: "Electronics & Gadgets",
        price: 4900,
        currency: "DZD",
        image_url: "https://e2e-winner-store.test/img/watch.jpg",
        current_stock: 60,
        initial_stock: 120,
        daily_velocity: 12.5,
        is_winner: true,
        winner_since: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      },
      {
        id: TRACK_ID,
        store_id: STORE_ID,
        external_id: "e2e-track-1",
        title: "E2E — Kitchen Blender",
        niche: "Kitchen Gadgets",
        price: 3500,
        currency: "DZD",
        image_url: "https://e2e-winner-store.test/img/blender.jpg",
        current_stock: 90,
        initial_stock: 100,
        daily_velocity: 0,
        is_winner: false,
      },
    ],
    { onConflict: "store_id,external_id" }
  );

  await client.from("product_snapshots").delete().eq("product_id", WINNER_ID);
  await client.from("product_snapshots").insert(
    [3, 2, 1, 0].map((d, i) => ({
      product_id: WINNER_ID,
      stock: [100, 88, 74, 60][i],
      price: 4900,
      captured_at: new Date(Date.now() - d * 86_400_000).toISOString(),
    }))
  );

  await client.from("ads").upsert(
    [
      {
        store_id: STORE_ID,
        meta_ad_id: "e2e-ad-1",
        ad_creative_url: "https://e2e-winner-store.test/img/watch.jpg",
        creative_type: "image" as never,
        ad_copy: "🔥 الدفع عند الاستلام - ساعة ذكية",
        platform: "facebook" as never,
        start_date: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10),
        is_active: true,
      },
      {
        store_id: STORE_ID,
        meta_ad_id: "e2e-ad-2",
        ad_creative_url: "https://e2e-winner-store.test/img/watch2.jpg",
        creative_type: "image" as never,
        ad_copy: "✨ عرض خاص - توصيل لكل الولايات",
        platform: "facebook" as never,
        start_date: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
        is_active: true,
      },
    ],
    { onConflict: "meta_ad_id" }
  );
}

export async function resetTestEnv(): Promise<Record<string, string>> {
  const client = createEngineClient();
  const ids: Record<string, string> = {};
  for (const [key, cfg] of Object.entries(E2E_USERS)) {
    const id = await ensureUser(client, cfg.email);
    await setSubscription(client, id, cfg.status, cfg.tier, cfg.expired);
    ids[key] = id;
  }
  await seedCatalog(client);
  return ids;
}

/** Remove E2E auth users + catalog fixtures (teardown). */
export async function teardownTestEnv(): Promise<void> {
  const client = createEngineClient();
  const { data: list } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of list?.users ?? []) {
    if (u.email?.endsWith("@e2e.test")) await client.auth.admin.deleteUser(u.id);
  }
  await client.from("stores").delete().eq("id", STORE_ID); // cascades to products/ads/snapshots
}

// CLI: `tsx scripts/reset-test-env.ts [--teardown]`
if (process.argv[1] && process.argv[1].includes("reset-test-env")) {
  const run = process.argv.includes("--teardown") ? teardownTestEnv() : resetTestEnv();
  run
    .then((r) => {
      console.log("[reset-test-env] done", r ?? "");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
