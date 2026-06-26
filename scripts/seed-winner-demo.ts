import "../lib/engine/load-env";

import { createEngineClient, computeWinners } from "../lib/engine";

/**
 * Seeds ONE tracking-enabled demo store whose products have engineered, GRADUAL
 * stock-depletion snapshots (drops well under the 100-unit manual-adjustment
 * guard) plus active ads — so computeWinners() flags them as Confirmed Winners.
 * Lets you verify the Winner UI, velocity display, and sort/filter.
 *
 * Uses REAL product titles/images/prices already scraped into the DB for realism.
 * Remove with: delete from stores where name like 'DEMO —%';
 */
async function main() {
  const c = createEngineClient();
  const now = Date.now();

  const { data: store, error: storeErr } = await c
    .from("stores")
    .upsert(
      {
        url: "https://demo-winner-store.myshopify.com",
        domain: "demo-winner-store.myshopify.com",
        name: "DEMO — Winner Store DZ ⚡",
        platform: "shopify",
        fb_page_name: "Lumina Algerie",
        country: "DZ",
        lead_score: 94,
        contact_email: "owner@winner-demo.dz",
        contact_phone: "+213551998877",
        is_active: true,
        ads_checked_at: new Date().toISOString(),
      },
      { onConflict: "url" }
    )
    .select("id")
    .single();
  if (storeErr || !store) throw new Error(storeErr?.message ?? "store upsert failed");
  const storeId = store.id;

  // Pull real products (title/image/price) from any other store for realism.
  const { data: realProducts } = await c
    .from("products")
    .select("title, price, image_url")
    .not("image_url", "is", null)
    .neq("store_id", storeId)
    .limit(8);
  const samples = (realProducts ?? []).slice(0, 5);
  if (samples.length === 0) {
    console.log("[seed-winner] No source products found. Run engine:inventory first.");
    return;
  }

  const days = 4;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const velocity = 25 - i * 3; // 25, 22, 19, 16, 13 units/day (all < 100)
    const latest = 60 - i * 5;
    const initial = latest + velocity * days;

    const { data: prod, error: prodErr } = await c
      .from("products")
      .upsert(
        {
          store_id: storeId,
          external_id: `winner-${i}`,
          handle: `winner-${i}`,
          title: sample.title,
          price: sample.price,
          currency: "DZD",
          image_url: sample.image_url,
          product_url: `https://demo-winner-store.myshopify.com/products/winner-${i}`,
          current_stock: latest,
          initial_stock: initial,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "store_id,external_id" }
      )
      .select("id")
      .single();
    if (prodErr || !prod) throw new Error(prodErr?.message ?? "product upsert failed");

    // Reset + insert gradual-depletion snapshots (oldest → newest).
    await c.from("product_snapshots").delete().eq("product_id", prod.id);
    const snaps = [];
    for (let d = days; d >= 0; d -= 1) {
      snaps.push({
        product_id: prod.id,
        stock: latest + velocity * d,
        captured_at: new Date(now - d * 86_400_000).toISOString(),
      });
    }
    await c.from("product_snapshots").insert(snaps);
  }

  // Active ads using real product images as reliable creatives.
  const adCopies = [
    "🔥 عرض خاص - الدفع عند الاستلام في كامل الولايات",
    "✨ المنتج الأصلي بضمان - اطلب الآن",
    "🚚 توصيل سريع 58 ولاية - ادفع عند الاستلام",
  ];
  await c.from("ads").delete().eq("store_id", storeId);
  const adRows = samples.slice(0, 3).map((s, i) => ({
    store_id: storeId,
    meta_ad_id: `winner-demo-ad-${i}`,
    ad_creative_url: s.image_url,
    creative_type: "image" as const,
    ad_copy: adCopies[i % adCopies.length],
    landing_url: "https://www.facebook.com/ads/library/",
    platform: "facebook" as const,
    start_date: new Date(now - (i + 2) * 86_400_000).toISOString().slice(0, 10),
    is_active: true,
  }));
  await c.from("ads").upsert(adRows, { onConflict: "meta_ad_id" });

  const { processed, winners } = await computeWinners(c);
  console.log(
    `[seed-winner] store=${storeId} products=${samples.length} ads=${adRows.length}`
  );
  console.log(`[seed-winner] computeWinners -> processed=${processed}, winners=${winners}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
