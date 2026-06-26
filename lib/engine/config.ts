/**
 * Central tuning for the scraping + winner engine. Values can be overridden via
 * environment variables so GitHub Actions can adjust behaviour without code changes.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const engineConfig = {
  /** Quantity used for the Shopify /cart/add.js threshold probe. */
  shopifyProbeQuantity: num("ENGINE_SHOPIFY_PROBE_QTY", 99999),
  /** Max products to stock-probe per store per run (protects small stores). */
  maxProductsPerStore: num("ENGINE_MAX_PRODUCTS_PER_STORE", 60),
  /** Randomized polite delay window between requests, in milliseconds. */
  minDelayMs: num("ENGINE_MIN_DELAY_MS", 800),
  maxDelayMs: num("ENGINE_MAX_DELAY_MS", 2600),
  /** Concurrency for page crawlers. Kept low to stay under the radar. */
  maxConcurrency: num("ENGINE_MAX_CONCURRENCY", 3),
  requestTimeoutMs: num("ENGINE_REQUEST_TIMEOUT_MS", 25000),

  /** Winner algorithm. */
  winner: {
    /** Lookback window (days) over which velocity is measured. */
    windowDays: num("ENGINE_WINNER_WINDOW_DAYS", 14),
    /** Minimum units/day depletion to qualify on the velocity axis. */
    minDailyVelocity: num("ENGINE_WINNER_MIN_VELOCITY", 3),
    /** Active Meta ads required for ad-backing confirmation. */
    minActiveAds: num("ENGINE_WINNER_MIN_ACTIVE_ADS", 1),
  },

  /** Meta Ad Library. */
  meta: {
    apiVersion: process.env.META_GRAPH_API_VERSION || "v21.0",
    reachedCountries: (process.env.META_REACHED_COUNTRIES || "DZ")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    pageSize: num("META_PAGE_SIZE", 50),
    maxPages: num("META_MAX_PAGES", 5),
  },
};

/** Rotating realistic desktop User-Agent strings for stealthy requests. */
export const USER_AGENTS: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];
