import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";
import type { StorePlatform } from "../types/supabase";

/**
 * Seeds the verified Algerian COD store list (Shopify / YouCan) as active
 * tracking targets. The engine cron + `npm run engine:inventory` will then
 * scrape these. Only entries with concrete URLs and a supported platform are
 * included. Idempotent (upsert on url).
 */
interface SeedStore {
  name: string;
  url: string;
  platform: StorePlatform;
}

const STORES: SeedStore[] = [
  // ---- Shopify ----
  { name: "Promoshopalgerie", url: "https://promoshopalgerie.com", platform: "shopify" },
  { name: "One01click", url: "https://one01click.shop", platform: "shopify" },
  { name: "Elixirshop", url: "https://elixirshop.store", platform: "shopify" },
  { name: "Kiabi Algérie", url: "https://kiabi.dz", platform: "shopify" },
  { name: "HB Manga Kissa", url: "https://hbmangakissa.com", platform: "shopify" },
  { name: "Dentodz", url: "https://dentodz.one", platform: "shopify" },
  { name: "Hanotna-dz", url: "https://hanotna-dz.com", platform: "shopify" },
  { name: "Ballersdz", url: "https://ballersdz.com", platform: "shopify" },
  { name: "Dziriyaa", url: "https://dziriyaa.com", platform: "shopify" },
  { name: "Friplo", url: "https://friplo.com", platform: "shopify" },
  { name: "Shoppadz", url: "https://shoppadz.com", platform: "shopify" },
  { name: "Eljdid", url: "https://eljdid.com", platform: "shopify" },
  { name: "Knin", url: "https://knin.store", platform: "shopify" },
  { name: "Sahlashop-dz", url: "https://sahlashop-dz.com", platform: "shopify" },
  { name: "Shopilydz", url: "https://shopilydz.shop", platform: "shopify" },
  { name: "Evexiapharmadz", url: "https://evexiapharmadz.com", platform: "shopify" },
  { name: "Vitrinadz", url: "https://vitrinadz.store", platform: "shopify" },
  { name: "Promoshopdz-ltd", url: "https://promoshopdz-ltd.com", platform: "shopify" },
  { name: "Elenoradz", url: "https://elenoradz.com", platform: "shopify" },
  { name: "Charbon Miracle DZ", url: "https://charbonmiracledz.myshopify.com", platform: "shopify" },
  { name: "MouleDz", url: "https://mouledz.myshopify.com", platform: "shopify" },
  { name: "Titian Store", url: "https://titian-store.com", platform: "shopify" },
  { name: "Bled and Beyond", url: "https://bledandbeyond.com", platform: "shopify" },
  { name: "DZ Store", url: "https://dzstore69.com", platform: "shopify" },
  // ---- YouCan ----
  { name: "Marketplace Algeria", url: "https://marketplace-algeria.youcan.store", platform: "youcan" },
  { name: "Mansif", url: "https://mansif.youcan.store", platform: "youcan" },
  { name: "Geant", url: "https://geant.youcan.store", platform: "youcan" },
  { name: "Academiati", url: "https://academiati.online", platform: "youcan" },
  { name: "Acuariofresco", url: "https://acuariofresco.shop", platform: "youcan" },
  { name: "Dzrline", url: "https://dzrline.com", platform: "youcan" },
  { name: "Makhlouf Ouzar", url: "https://makhloufouzar.site", platform: "youcan" },
  { name: "KMS Gros", url: "https://kmsgros.com", platform: "youcan" },
  { name: "Chifaa Bio", url: "https://chifaabio.shop", platform: "youcan" },
];

async function main() {
  const client = createEngineClient();
  let count = 0;
  for (const s of STORES) {
    const host = new URL(s.url).host;
    const { error } = await client.from("stores").upsert(
      {
        url: new URL(s.url).origin,
        domain: host,
        name: s.name,
        platform: s.platform,
        fb_page_name: s.name,
        country: "DZ",
        is_active: true,
      },
      { onConflict: "url" }
    );
    if (error) {
      console.error(`[seed-list] ${s.url}: ${error.message}`);
    } else {
      count += 1;
    }
  }
  console.log(`[seed-list] upserted ${count}/${STORES.length} stores.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
