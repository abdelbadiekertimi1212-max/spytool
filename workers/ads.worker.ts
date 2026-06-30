import { MetaAdLibraryScraper } from "../lib/engine";
import { persistAds } from "../lib/engine/persistence";
import { jitter } from "../lib/engine/http";
import { logEngine } from "../lib/engine/logger";
import { CONCURRENCY, QUEUE, type WorkerDef } from "../lib/queue/jobs";

function deriveStoreName(url: string, fallback: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]+/g, " ");
  } catch {
    return fallback ?? url;
  }
}

/** Stage 4: verify active Meta ads per store (mirrors the cron script). */
export const adsWorker: WorkerDef = {
  name: QUEUE.ads,
  concurrency: CONCURRENCY.ads,
  run: async (client) => {
    const { data: stores, error } = await client
      .from("stores")
      .select("id, url, fb_page_id, fb_page_name")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    if (!stores || stores.length === 0) return;

    const scraper = new MetaAdLibraryScraper();
    await scraper.init();
    try {
      for (const store of stores) {
        try {
          const ads = await scraper.search(deriveStoreName(store.url, store.fb_page_name));
          await persistAds(client, store.id, ads);
        } catch (err) {
          await logEngine(client, "error", "ads", `failed ${store.url}: ${(err as Error).message}`, {
            url: store.url,
          });
        }
        await jitter();
      }
    } finally {
      await scraper.close();
    }
  },
};
