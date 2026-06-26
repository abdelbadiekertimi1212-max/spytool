import type { StorePlatform } from "../../types/supabase";

/**
 * A single product as extracted by a platform scraper, before persistence.
 * `stock === null` means "unknown / could not be determined" (e.g. a Shopify
 * variant whose threshold add-to-cart succeeded above our probe quantity).
 */
export interface ScrapedProduct {
  externalId: string;
  handle: string | null;
  title: string;
  description: string | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string | null;
  stock: number | null;
}

export interface ScrapeResult {
  platform: StorePlatform;
  storeUrl: string;
  products: ScrapedProduct[];
}

/**
 * Normalized active ad extracted from the public Meta Ad Library website via
 * the Playwright stealth scraper. Unlike the official API (which only returns a
 * snapshot URL for commercial ads), DOM scraping also yields the real creative
 * `mediaUrl` (image/video), which the dashboard renders directly.
 */
export interface NormalizedAd {
  metaAdId: string;
  pageId: string | null;
  pageName: string | null;
  adCopy: string | null;
  ctaText: string | null;
  /** Deep-link to the ad's Ad Library detail page. */
  snapshotUrl: string | null;
  /** Direct image/video URL scraped from the card (may be a CDN URL). */
  mediaUrl: string | null;
  landingUrl: string | null;
  platform: "facebook" | "instagram" | "audience_network" | "messenger";
  creativeType: "image" | "video" | "carousel" | "dco";
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  raw: unknown;
}

export interface StoreScrapeTarget {
  id: string;
  url: string;
  platform: StorePlatform;
  fbPageId: string | null;
  fbPageName: string | null;
}
