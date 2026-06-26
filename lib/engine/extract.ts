import type { CheerioAPI } from "cheerio";

import { toNumber } from "./http";
import type { StorePlatform } from "../../types/supabase";

export interface ExtractedStock {
  stock: number | null;
  available: boolean | null;
}

/**
 * Default-theme selectors per platform. These target the stock/quantity
 * controls and price/title markup of the stock YouCan and Storeino themes.
 * Most Algerian stores run custom domains but keep the default theme DOM, so
 * these are a reasonable baseline; fine-tune against real `.dz` URLs in Phase 3.
 */
interface ThemeSelectors {
  title: string[];
  price: string[];
  stock: { sel: string; attr: string }[];
}

const THEME: Partial<Record<StorePlatform, ThemeSelectors>> = {
  youcan: {
    title: ["h1.product-title", ".product__title", ".product-info h1", "h1"],
    price: [
      "[data-product-price]",
      ".product-price",
      ".price-current",
      ".price",
    ],
    stock: [
      { sel: "input[name='quantity']", attr: "max" },
      { sel: ".product-form input[type='number']", attr: "max" },
      { sel: "[data-inventory]", attr: "data-inventory" },
      { sel: "[data-stock]", attr: "data-stock" },
    ],
  },
  storeino: {
    title: ["h1.product-title", ".product-name h1", ".product_title", "h1"],
    price: ["[data-price]", ".product-price", ".current-price", ".price"],
    stock: [
      { sel: "input.quantity-input", attr: "max" },
      { sel: "input[name='qty']", attr: "max" },
      { sel: "input[name='quantity']", attr: "max" },
      { sel: "[data-stock]", attr: "data-stock" },
      { sel: "[data-quantity]", attr: "data-quantity" },
    ],
  },
};

/**
 * Best-effort stock extraction. Tries, in order: platform theme selectors,
 * explicit numeric JSON keys in the payload, generic quantity-input bounds, and
 * finally JSON-LD availability as a boolean. Returns `stock: null` when no count
 * is found (availability may still be set).
 */
export function extractStock(
  html: string,
  $: CheerioAPI,
  platform?: StorePlatform
): ExtractedStock {
  // 0. Platform default-theme stock controls.
  const theme = platform ? THEME[platform] : undefined;
  if (theme) {
    for (const { sel, attr } of theme.stock) {
      const n = toNumber($(sel).first().attr(attr));
      if (n !== null && n >= 0) return { stock: n, available: n > 0 };
    }
  }

  // 1. Numeric inventory keys commonly present in inline JSON / SSR state.
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
      if (Number.isFinite(n) && n >= 0) return { stock: n, available: n > 0 };
    }
  }

  // 2. Generic quantity input upper bound / data attributes.
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
  return { stock: null, available: extractJsonLdAvailability($) };
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

function firstText($: CheerioAPI, selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.attr("content") || el.text();
      if (text && text.trim()) return text.trim();
    }
  }
  return null;
}

/** Extract core product fields via platform theme selectors, then OG/JSON-LD. */
export function extractProduct(
  html: string,
  $: CheerioAPI,
  platform?: StorePlatform
): ExtractedProduct {
  const theme = platform ? THEME[platform] : undefined;

  const title =
    (theme && firstText($, theme.title)) ||
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    null;

  let price: number | null = null;
  if (theme) {
    const themePrice = firstText($, theme.price);
    // Strip currency symbols / thousands separators before parsing.
    price = toNumber(themePrice?.replace(/[^\d.,]/g, "").replace(",", "."));
  }
  if (price === null) {
    price =
      toNumber($('meta[property="product:price:amount"]').attr("content")) ??
      toNumber($('meta[property="og:price:amount"]').attr("content"));
  }
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
