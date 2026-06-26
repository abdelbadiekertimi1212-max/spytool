import { crawlStorefront } from "./crawl";
import type { ScrapeResult } from "./types";

const PRODUCT_PATH = /\/(products?|p)\//i;

/**
 * YouCan storefront scraper. YouCan product pages live under paths like
 * `/products/<slug>` (and occasionally `/p/<slug>`) and embed stock in inline
 * JSON / quantity controls, which `extractStock` resolves.
 */
export function scrapeYouCan(storeUrl: string): Promise<ScrapeResult> {
  return crawlStorefront(storeUrl, "youcan", {
    isProductUrl: (url) => PRODUCT_PATH.test(url),
    productGlobs: (origin) => [
      `${origin}/products/**`,
      `${origin}/product/**`,
      `${origin}/p/**`,
    ],
  });
}
