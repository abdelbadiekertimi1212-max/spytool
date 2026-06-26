import "dotenv/config";

import { createEngineClient, scrapeStore } from "../lib/engine";
import { persistScrape } from "../lib/engine/persistence";
import { jitter } from "../lib/engine/http";

/**
 * Inventory pass: for every active store, run the platform scraper, upsert
 * products and append a stock snapshot for each. Designed to run on a schedule
 * (GitHub Actions cron). Per-store failures are isolated so one bad store can't
 * abort the whole run.
 */
async function main() {
  const client = createEngineClient();

  const { data: stores, error } = await client
    .from("stores")
    .select("id, url, platform, fb_page_id, fb_page_name")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to load stores: ${error.message}`);
  if (!stores || stores.length === 0) {
    console.log("[inventory] no active stores to scrape.");
    return;
  }

  let totalProducts = 0;
  let totalSnapshots = 0;

  for (const store of stores) {
    try {
      const result = await scrapeStore({
        id: store.id,
        url: store.url,
        platform: store.platform,
        fbPageId: store.fb_page_id,
        fbPageName: store.fb_page_name,
      });
      const { upserted, snapshots } = await persistScrape(
        client,
        store.id,
        result
      );
      totalProducts += upserted;
      totalSnapshots += snapshots;
      console.log(
        `[inventory] ${store.url} → ${upserted} products, ${snapshots} snapshots`
      );
    } catch (err) {
      console.error(
        `[inventory] failed ${store.url}: ${(err as Error).message}`
      );
    }
    await jitter();
  }

  console.log(
    `[inventory] done. ${totalProducts} products, ${totalSnapshots} snapshots across ${stores.length} stores.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
