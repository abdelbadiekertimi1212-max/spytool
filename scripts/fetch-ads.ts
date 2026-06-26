import "dotenv/config";

import { createEngineClient, fetchActiveAds } from "../lib/engine";
import { persistAds } from "../lib/engine/persistence";
import { jitter } from "../lib/engine/http";

/**
 * Ad-verification pass: query the Meta Ad Library for ACTIVE ads for each store
 * (by Facebook Page ID, falling back to page-name search) and persist them.
 * This supplies the "ad-backing" axis of the winner algorithm.
 */
async function main() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || token === "placeholder") {
    throw new Error(
      "META_ACCESS_TOKEN is not configured. Set it before running fetch-ads."
    );
  }

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

  let totalAds = 0;

  for (const store of stores) {
    const pageIds = store.fb_page_id ? [store.fb_page_id] : undefined;
    const searchTerms = !pageIds ? store.fb_page_name ?? undefined : undefined;

    if (!pageIds && !searchTerms) {
      console.log(`[ads] skip ${store.url} (no fb_page_id or fb_page_name)`);
      continue;
    }

    try {
      const ads = await fetchActiveAds({ accessToken: token, pageIds, searchTerms });
      const count = await persistAds(client, store.id, ads);
      totalAds += count;
      console.log(`[ads] ${store.url} → ${count} active ads`);
    } catch (err) {
      console.error(`[ads] failed ${store.url}: ${(err as Error).message}`);
    }
    await jitter();
  }

  console.log(`[ads] done. ${totalAds} active ads across ${stores.length} stores.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
