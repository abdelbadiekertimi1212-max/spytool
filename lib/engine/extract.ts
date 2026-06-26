import type { CheerioAPI } from "cheerio";

import { toNumber } from "./http";

export interface ExtractedStock {
  stock: number | null;
  available: boolean | null;
}

/**
 * Best-effort stock extraction for storefronts that embed inventory in the page
 * (YouCan / Storeino). Tries, in order: explicit numeric JSON keys, quantity
 * input bounds / data-attributes, then JSON-LD availability as a boolean signal.
 *
 * Returns `stock: null` when no count is found (availability may still be set).
 * Selectors here are intentionally broad; tune them against live DOM in review.
 */
export function extractStock(html: string, $: CheerioAPI): ExtractedStock {
  // 1. Numeric inventory keys commonly present in inline JSON / __NEXT/NUXT state.
  const numericKeys = [
    "available_quantity",
    "inventory_quantity",
    "inventory",
    "quantity",
    "in_stock",
    "stock",
    "qty",
  ];
  for (const key of numericKeys) {
    const re = new RegExp(`["']${key}["']\\s*:\\s*"?(-?\\d+)"?`, "i");
    const m = html.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0) {
        return { stock: n, available: n > 0 };
      }
    }
  }

  // 2. Quantity input upper bound (themes cap the selector at available stock).
  const maxAttr =
    $("input[type=number][max]").attr("max") ||
    $("[data-max-quantity]").attr("data-max-quantity") ||
    $("[data-stock]").attr("data-stock") ||
    $("[data-quantity]").attr("data-quantity");
  const maxNum = toNumber(maxAttr);
  if (maxNum !== null && maxNum >= 0) {
    return { stock: maxNum, available: maxNum > 0 };
  }

  // 3. JSON-LD availability (boolean signal only — no count).
  const available = extractJsonLdAvailability($);
  return { stock: null, available };
}

function extractJsonLdAvailability($: CheerioAPI): boolean | null {
  let result: boolean | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result !== null) return;
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const offers = node?.offers;
        const availability =
          offers?.availability ?? offers?.[0]?.availability ?? null;
        if (typeof availability === "string") {
          result = /InStock/i.test(availability);
          return;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });
  return result;
}

export interface ExtractedProduct {
  title: string | null;
  price: number | null;
  imageUrl: string | null;
  description: string | null;
}

/** Extract core product fields from OpenGraph / JSON-LD / common meta tags. */
export function extractProduct(html: string, $: CheerioAPI): ExtractedProduct {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    null;

  const priceMeta =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content") ||
    null;

  let price = toNumber(priceMeta);
  if (price === null) {
    const m = html.match(/["']price["']\s*:\s*"?(\d+(?:\.\d+)?)"?/i);
    if (m) price = toNumber(m[1]);
  }

  const imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    null;

  return {
    title: title ? title.slice(0, 300) : null,
    price,
    imageUrl,
    description: description ? description.slice(0, 2000) : null,
  };
}

/** Derive a stable external id / handle from a product URL path. */
export function handleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const slug = path.split("/").filter(Boolean).pop();
    return slug || path || url;
  } catch {
    return url;
  }
}
