import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";

/** Quick database health snapshot: store/product/winner/ad counts + samples. */
async function main() {
  const c = createEngineClient();

  const head = { count: "exact" as const, head: true };
  const [{ count: activeStores }, { count: totalStores }] = await Promise.all([
    c.from("stores").select("*", head).eq("is_active", true),
    c.from("stores").select("*", head),
  ]);
  const [{ count: totalProducts }, { count: winners }, { count: activeAds }] =
    await Promise.all([
      c.from("products").select("*", head),
      c.from("products").select("*", head).eq("is_winner", true),
      c.from("ads").select("*", head).eq("is_active", true),
    ]);

  console.log(
    `active_stores=${activeStores} total_stores=${totalStores} total_products=${totalProducts} winners=${winners} active_ads=${activeAds}`
  );

  const { data: byPlatform } = await c.from("stores").select("platform");
  const counts: Record<string, number> = {};
  for (const s of byPlatform ?? [])
    counts[s.platform] = (counts[s.platform] ?? 0) + 1;
  console.log("stores by platform:", JSON.stringify(counts));

  const { data: nicheRows } = await c.from("products").select("niche");
  const nicheCounts: Record<string, number> = {};
  for (const r of nicheRows ?? []) {
    const key = r.niche ?? "(untagged)";
    nicheCounts[key] = (nicheCounts[key] ?? 0) + 1;
  }
  const topNiches = Object.entries(nicheCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  console.log("niches:");
  for (const [n, c2] of topNiches) console.log(`  • ${n}: ${c2}`);

  const { data: sample } = await c
    .from("products")
    .select("title, price, currency")
    .order("created_at", { ascending: false })
    .limit(20);
  console.log("recent product titles:");
  for (const p of sample ?? []) {
    console.log(`  • ${p.title}${p.price ? ` — ${p.price} ${p.currency}` : ""}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
