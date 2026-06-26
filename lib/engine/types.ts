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

/** Normalized active ad extracted from the Meta Ad Library API. */
export interface NormalizedAd {
  metaAdId: string;
  pageId: string | null;
  pageName: string | null;
  adCopy: string | null;
  ctaText: string | null;
  snapshotUrl: string | null;
  landingUrl: string | null;
  platform: "facebook" | "instagram" | "audience_network" | "messenger";
  creativeType: "image" | "video" | "carousel" | "dco";
  startDate: string | null;
  endDate: string | null;
  raw: unknown;
}

export interface StoreScrapeTarget {
  id: string;
  url: string;
  platform: StorePlatform;
  fbPageId: string | null;
  fbPageName: string | null;
}
