import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";

/**
 * Seeds clearly-labelled DEMO data so the dashboard can be viewed end-to-end
 * before the live engine has populated real winners. Every store name is
 * prefixed "DEMO —". Remove later with:
 *   delete from stores where name like 'DEMO —%';   -- cascades to products/ads
 *
 * Idempotent: re-running upserts the same rows (stable external ids).
 */
function img(seed: string): string {
  return `https://picsum.photos/seed/${seed}/600/600`;
}

const STORES = [
  {
    key: "lumina",
    url: "https://luminaalgerie.myshopify.com",
    name: "DEMO — Lumina Algérie",
    platform: "shopify" as const,
    fb_page_name: "Lumina Algerie",
    lead_score: 88,
    contact_email: "contact@lumina-demo.dz",
    contact_phone: "+213551234567",
  },
  {
    key: "beauty",
    url: "https://beautydz-demo.youcan.shop",
    name: "DEMO — Beauty DZ",
    platform: "youcan" as const,
    fb_page_name: "Beauty DZ",
    lead_score: 73,
    contact_email: "hello@beautydz-demo.dz",
    contact_phone: "+213661112233",
  },
  {
    key: "gadget",
    url: "https://gadgetdziri-demo.storeino.com",
    name: "DEMO — Gadget Dziri",
    platform: "storeino" as const,
    fb_page_name: "Gadget Dziri",
    lead_score: 61,
    contact_email: "sales@gadgetdziri-demo.dz",
    contact_phone: "+213770445566",
  },
];

const PRODUCTS: Record<string, { title: string; price: number; velocity: number; stock: number }[]> = {
  lumina: [
    { title: "Kit Hexagon LED 400W — إضاءة احترافية", price: 48000, velocity: 23.5, stock: 41 },
    { title: "مصباح شمسي COBRA 100W بضمان 12 شهر", price: 5600, velocity: 18.2, stock: 120 },
    { title: "مروحة محمولة + إضاءة LED برودة فورية", price: 3900, velocity: 12.7, stock: 64 },
    { title: "Lampe Solaire 200W — 12h d'autonomie", price: 8900, velocity: 9.1, stock: 88 },
  ],
  beauty: [
    { title: "سيروم فيتامين C للبشرة الجزائرية", price: 2500, velocity: 15.4, stock: 53 },
    { title: "Coffret Soin Visage — Hydratation 24h", price: 4300, velocity: 8.6, stock: 47 },
    { title: "جهاز تنظيف الوجه بالموجات", price: 6200, velocity: 6.3, stock: 30 },
  ],
  gadget: [
    { title: "ساعة ذكية Smart Watch Pro بالعربية", price: 7400, velocity: 11.9, stock: 72 },
    { title: "Écouteurs sans fil TWS — Bass+", price: 3200, velocity: 7.2, stock: 95 },
    { title: "كاميرا مراقبة WiFi بدقة عالية", price: 5900, velocity: 5.8, stock: 40 },
  ],
};

const AD_COPY: Record<string, string[]> = {
  lumina: [
    "🔥 عرض خاص: إضاءة احترافية لمنزلك ومحلك. الدفع عند الاستلام لكل الولايات!",
    "Profitez de notre kit LED — livraison 58 wilayas, paiement à la livraison.",
  ],
  beauty: [
    "✨ بشرة مشرقة في 7 أيام. منتج أصلي مع ضمان الجودة. اطلبي الآن!",
    "Offre limitée : routine soin complète à prix imbattable. COD disponible.",
  ],
  gadget: [
    "⌚ الساعة الذكية الأكثر مبيعاً في الجزائر. توصيل سريع ودفع عند الاستلام.",
    "Gadget tendance — stock limité. Commandez aujourd'hui, payez à la réception.",
  ],
};

async function main() {
  const client = createEngineClient();
  const now = Date.now();

  for (const store of STORES) {
    const { data: storeRow, error: storeErr } = await client
      .from("stores")
      .upsert(
        {
          url: store.url,
          domain: new URL(store.url).host,
          name: store.name,
          platform: store.platform,
          fb_page_name: store.fb_page_name,
          country: "DZ",
          lead_score: store.lead_score,
          contact_email: store.contact_email,
          contact_phone: store.contact_phone,
          is_active: true,
          ads_checked_at: new Date().toISOString(),
        },
        { onConflict: "url" }
      )
      .select("id")
      .single();
    if (storeErr || !storeRow) throw new Error(storeErr?.message ?? "store upsert failed");

    // Products (all flagged as winners).
    const products = PRODUCTS[store.key];
    const productRows = products.map((p, i) => ({
      store_id: storeRow.id,
      external_id: `${store.key}-p${i}`,
      handle: `${store.key}-p${i}`,
      title: p.title,
      price: p.price,
      currency: "DZD",
      image_url: img(`${store.key}${i}`),
      product_url: `${store.url}/products/${store.key}-p${i}`,
      current_stock: p.stock,
      initial_stock: p.stock + Math.round(p.velocity * 7),
      total_sold: Math.round(p.velocity * 7),
      daily_velocity: p.velocity,
      is_winner: true,
      winner_since: new Date(now - (i + 1) * 86_400_000).toISOString(),
      last_checked_at: new Date().toISOString(),
    }));

    const { data: upProducts, error: prodErr } = await client
      .from("products")
      .upsert(productRows, { onConflict: "store_id,external_id" })
      .select("id, external_id");
    if (prodErr) throw new Error(prodErr.message);

    // Two snapshots per product (gradual depletion supporting the velocity).
    const snapshotRows: { product_id: string; stock: number; captured_at: string }[] = [];
    for (let i = 0; i < products.length; i += 1) {
      const id = (upProducts ?? []).find((r) => r.external_id === `${store.key}-p${i}`)?.id;
      if (!id) continue;
      const p = products[i];
      snapshotRows.push({
        product_id: id,
        stock: p.stock + Math.round(p.velocity * 2),
        captured_at: new Date(now - 2 * 86_400_000).toISOString(),
      });
      snapshotRows.push({
        product_id: id,
        stock: p.stock,
        captured_at: new Date(now).toISOString(),
      });
    }
    if (snapshotRows.length > 0) {
      await client.from("product_snapshots").insert(snapshotRows);
    }

    // Active ads.
    const adRows = AD_COPY[store.key].map((copy, i) => ({
      store_id: storeRow.id,
      meta_ad_id: `demo-${store.key}-ad${i}`,
      ad_creative_url: img(`${store.key}ad${i}`),
      creative_type: "image" as const,
      ad_copy: copy,
      landing_url: `https://www.facebook.com/ads/library/?id=demo-${store.key}-ad${i}`,
      platform: "facebook" as const,
      start_date: new Date(now - (i + 3) * 86_400_000).toISOString().slice(0, 10),
      is_active: true,
    }));
    await client.from("ads").upsert(adRows, { onConflict: "meta_ad_id" });

    console.log(`[seed-demo] ${store.name}: ${products.length} winners, ${adRows.length} ads`);
  }

  console.log("[seed-demo] done. Remove with: delete from stores where name like 'DEMO —%';");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
