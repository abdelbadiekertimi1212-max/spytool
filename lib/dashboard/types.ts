import type { Ad, Product, Store } from "@/types/supabase";

/**
 * A tracked product joined with its store and the store's ads. Ads are linked
 * at the STORE level (ads.product_id is usually null), so the feed card reads
 * `store.ads`, not a per-product ads array.
 */
export type WinnerProduct = Product & {
  store: (Store & { ads: Ad[] }) | null;
  /** Transient (not from DB select): set by the page from the user's bookmarks. */
  bookmarked?: boolean;
};

/** A B2B lead row: a store enriched with winner/velocity aggregates. */
export type LeadRow = Store & {
  winner_count: number;
  max_velocity: number;
  active_ads: number;
};
