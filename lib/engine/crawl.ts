import { CheerioCrawler, Configuration } from "crawlee";

import { engineConfig } from "./config";
import { jitter, originOf, stealthHeaders } from "./http";
import { extractProduct, extractStock, handleFromUrl } from "./extract";
import type { ScrapedProduct, ScrapeResult } from "./types";
import type { StorePlatform } from "../../types/supabase";

export interface CrawlOptions {
  /** Glob patterns (relative to origin) that identify product pages. */
  productGlobs: (origin: string) => string[];
  /** Predicate: does this URL look like a product detail page? */
  isProductUrl: (url: string) => boolean;
}

/**
 * Generic stealth storefront crawler built on Crawlee's CheerioCrawler.
 * Starts at the store URL, enqueues product-looking links on the same domain,
 * and extracts product + stock from each product page. Used for YouCan and
 * Storeino, which embed inventory directly in the HTML/JSON payload.
 */
export async function crawlStorefront(
  storeUrl: string,
  platform: StorePlatform,
  opts: CrawlOptions
): Promise<ScrapeResult> {
  const origin = originOf(storeUrl);
  const products: ScrapedProduct[] = [];
  const seen = new Set<string>();

  // In-memory storage only — no ./storage artifacts in CI.
  const config = new Configuration({ persistStorage: false });

  const crawler = new CheerioCrawler(
    {
      maxConcurrency: engineConfig.maxConcurrency,
      maxRequestsPerCrawl: engineConfig.maxProductsPerStore + 25,
      requestHandlerTimeoutSecs:
        Math.ceil(engineConfig.requestTimeoutMs / 1000) + 15,
      additionalMimeTypes: ["application/json"],
      preNavigationHooks: [
        async (_ctx, gotOptions) => {
          gotOptions.headers = {
            ...gotOptions.headers,
            ...stealthHeaders(origin),
          };
        },
      ],
      async requestHandler({ request, $, body, enqueueLinks }) {
        const html = body.toString();

        if (!opts.isProductUrl(request.url)) {
          // Listing / category / home page — enqueue product links.
          await enqueueLinks({
            globs: opts.productGlobs(origin),
            label: "PRODUCT",
          });
          return;
        }

        if (seen.has(request.url)) return;
        seen.add(request.url);

        if (products.length >= engineConfig.maxProductsPerStore) return;

        const core = extractProduct(html, $, platform);
        if (!core.title) return;
        const { stock } = extractStock(html, $, platform);

        products.push({
          externalId: handleFromUrl(request.url),
          handle: handleFromUrl(request.url),
          title: core.title,
          description: core.description,
          price: core.price,
          compareAtPrice: null,
          currency: "DZD",
          imageUrl: core.imageUrl,
          productUrl: request.url,
          stock,
        });

        await jitter();
      },
      failedRequestHandler({ request }) {
        // Non-fatal: log and continue so one bad page can't kill the crawl.
        console.warn(`[crawl] request failed: ${request.url}`);
      },
    },
    config
  );

  await crawler.run([{ url: storeUrl, label: "LIST" }]);

  return {
    platform,
    storeUrl,
    products: products.slice(0, engineConfig.maxProductsPerStore),
  };
}
