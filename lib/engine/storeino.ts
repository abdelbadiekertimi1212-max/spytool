import { crawlStorefront } from "./crawl";
import type { ScrapeResult } from "./types";

const PRODUCT_PATH = /\/(products?|item|p)\//i;

/**
 * Storeino storefront scraper. Storeino product pages typically sit under
 * `/products/<slug>` (sometimes `/item/<slug>`) and expose stock via inline
 * JSON / data attributes parsed by `extractStock`.
 */
export function scrapeStoreino(storeUrl: string): Promise<ScrapeResult> {
  return crawlStorefront(storeUrl, "storeino", {
    isProductUrl: (url) => PRODUCT_PATH.test(url),
    productGlobs: (origin) => [
      `${origin}/products/**`,
      `${origin}/product/**`,
      `${origin}/item/**`,
      `${origin}/p/**`,
    ],
  });
}
