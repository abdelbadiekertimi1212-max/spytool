import { scrapeShopify } from "./shopify";
import { scrapeYouCan } from "./youcan";
import { scrapeStoreino } from "./storeino";
import type { ScrapeResult, StoreScrapeTarget } from "./types";

export * from "./types";
export { createEngineClient } from "./supabase";
export { persistScrape, persistAds } from "./persistence";
export { fetchActiveAds } from "./meta-ads";
export { computeWinners } from "./winner";

/** Route a store to the correct platform scraper. */
export function scrapeStore(target: StoreScrapeTarget): Promise<ScrapeResult> {
  switch (target.platform) {
    case "shopify":
      return scrapeShopify(target.url);
    case "youcan":
      return scrapeYouCan(target.url);
    case "storeino":
      return scrapeStoreino(target.url);
    default: {
      // Exhaustiveness guard — a new platform enum must add a scraper here.
      const _never: never = target.platform;
      throw new Error(`Unsupported platform: ${String(_never)}`);
    }
  }
}
