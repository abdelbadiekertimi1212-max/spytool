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
    /** Ad-spend commitment: oldest active ad must be running longer than this. */
    minAdAgeDays: num("ENGINE_WINNER_MIN_AD_AGE_DAYS", 3),
    /** Ad-spend commitment: store must run at least this many distinct creatives. */
    minDistinctCreatives: num("ENGINE_WINNER_MIN_CREATIVES", 2),
    /** lead_score boost (points) for a product scaled by multiple stores. */
    consensusBoost: num("ENGINE_WINNER_CONSENSUS_BOOST", 25),
    /**
     * Smart-velocity guard. A single between-snapshot stock drop of this many
     * units or more is treated as a MANUAL inventory adjustment (e.g. a merchant
     * resetting 1000→0) and is NOT counted as sales. Only gradual drops below
     * this threshold contribute to velocity, preventing false-positive winners.
     */
    maxSaleDropPerWindow: num("ENGINE_WINNER_MAX_SALE_DROP", 100),
  },

  /** Meta Ad Library (public website scraper — no official API token). */
  meta: {
    /** Country filter for the Ad Library search (ISO-2). */
    searchCountry: (
      process.env.META_SEARCH_COUNTRY ||
      (process.env.META_REACHED_COUNTRIES || "DZ").split(",")[0] ||
      "DZ"
    ).trim(),
    /** Max ads to keep per store per run. */
    maxAdsPerStore: num("META_MAX_ADS_PER_STORE", 30),
    /** How many lazy-load scrolls to perform on the results page. */
    maxScrolls: num("META_MAX_SCROLLS", 6),
    /** Navigation timeout for the Ad Library page (ms). */
    navTimeoutMs: num("META_NAV_TIMEOUT_MS", 45000),
    /** Run the browser headless (set META_HEADLESS=false to debug locally). */
    headless: (process.env.META_HEADLESS ?? "true") !== "false",
  },

  /** Auto-discovery engine (broad Ad Library search → new store seeding). */
  discover: {
    /** Broad Algerian-COD keywords searched when none are passed on the CLI. */
    keywords: (
      process.env.DISCOVER_KEYWORDS ||
      "الدفع عند الاستلام,التوصيل مجاني,58 ولاية,الدفع عند الاستلام الجزائر,سلعة العلمة,أسواق العلمة"
    )
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    /** Max candidate domains to resolve+detect per keyword (politeness cap). */
    maxCandidatesPerKeyword: num("DISCOVER_MAX_CANDIDATES", 40),
  },
};

/** Rotating realistic desktop User-Agent strings for stealthy requests. */
export const USER_AGENTS: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];
