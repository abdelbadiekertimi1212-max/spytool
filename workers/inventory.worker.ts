import { scrapeStore } from "../lib/engine";
import { persistScrape, purgePlaceholders } from "../lib/engine/persistence";
import { jitter } from "../lib/engine/http";
import { logEngine } from "../lib/engine/logger";
import { CONCURRENCY, QUEUE, type WorkerDef } from "../lib/queue/jobs";

/** Stage 2: scrape inventory + snapshot for every active store (mirrors the cron script). */
export const inventoryWorker: WorkerDef = {
  name: QUEUE.inventory,
  concurrency: CONCURRENCY.inventory,
  run: async (client) => {
    const { data: stores, error } = await client
      .from("stores")
      .select("id, url, platform, fb_page_id, fb_page_name")
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    for (const store of stores ?? []) {
      try {
        const result = await scrapeStore({
          id: store.id,
          url: store.url,
          platform: store.platform,
          fbPageId: store.fb_page_id,
          fbPageName: store.fb_page_name,
        });
        await persistScrape(client, store.id, result);
      } catch (err) {
        await logEngine(client, "error", "inventory", `failed ${store.url}: ${(err as Error).message}`, {
          url: store.url,
        });
      }
      await jitter();
    }
    await purgePlaceholders(client);
  },
};
