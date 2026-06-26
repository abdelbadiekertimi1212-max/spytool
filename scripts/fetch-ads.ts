import "../lib/engine/load-env";

import { createEngineClient, MetaAdLibraryScraper } from "../lib/engine";
import { persistAds } from "../lib/engine/persistence";
import { jitter } from "../lib/engine/http";

/** Best search term for a store: its FB page name, else a name derived from the domain. */
function deriveStoreName(url: string, fallback: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim();
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    return base.replace(/[-_]+/g, " ");
  } catch {
    return fallback ?? url;
  }
}

/**
 * Ad-verification pass via the public Meta Ad Library website (Playwright
 * stealth scraper — no official API token). One browser is shared across all
 * stores; per-store failures are isolated.
 */
async function main() {
  const client = createEngineClient();

  const { data: stores, error } = await client
    .from("stores")
    .select("id, url, fb_page_id, fb_page_name")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to load stores: ${error.message}`);
  if (!stores || stores.length === 0) {
    console.log("[ads] no active stores.");
    return;
  }

  const scraper = new MetaAdLibraryScraper();
  await scraper.init();

  let totalAds = 0;
  try {
    for (const store of stores) {
      const term = deriveStoreName(store.url, store.fb_page_name);
      try {
        const ads = await scraper.search(term);
        const count = await persistAds(client, store.id, ads);
        totalAds += count;
        console.log(`[ads] ${store.url} (q="${term}") → ${count} active ads`);
      } catch (err) {
        console.error(`[ads] failed ${store.url}: ${(err as Error).message}`);
      }
      await jitter();
    }
  } finally {
    await scraper.close();
  }

  console.log(`[ads] done. ${totalAds} active ads across ${stores.length} stores.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
