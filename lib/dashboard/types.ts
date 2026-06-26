import type { Ad, Product, Store } from "@/types/supabase";

/** A winning product joined with its store and active ads (feed card data). */
export type WinnerProduct = Product & {
  store: Store | null;
  ads: Ad[];
};

/** A B2B lead row: a store enriched with winner/velocity aggregates. */
export type LeadRow = Store & {
  winner_count: number;
  max_velocity: number;
  active_ads: number;
};
