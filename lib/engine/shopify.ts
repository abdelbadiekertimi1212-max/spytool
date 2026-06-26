import { engineConfig } from "./config";
import { fetchWithTimeout, jitter, originOf, toNumber } from "./http";
import type { ScrapedProduct, ScrapeResult } from "./types";

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  available?: boolean;
  sku?: string | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  variants: ShopifyVariant[];
  images: { src: string }[];
}

interface ProductsJson {
  products: ShopifyProduct[];
}

/**
 * Shopify exposes a public `/products.json` feed. It does NOT include stock
 * counts, so we read product/variant/price/image from it and then derive stock
 * separately via the cart threshold probe below.
 */
async function fetchProductsPage(
  origin: string,
  page: number
): Promise<ShopifyProduct[]> {
  const url = `${origin}/products.json?limit=250&page=${page}`;
  const response = await fetchWithTimeout(url, {
    origin,
    allowedStatuses: [404],
  });
  if (response.status === 404) return [];
  const body = (await response.json()) as ProductsJson;
  return body.products ?? [];
}

/**
 * Threshold "hack": ask the cart to add an absurd quantity of a variant. When
 * inventory is tracked, Shopify replies 422 with a message revealing exactly how
 * many units are available ("You can only add N ..."). Untracked inventory adds
 * successfully (200) and we report stock as unknown (null).
 */
export async function probeShopifyStock(
  origin: string,
  variantId: number
): Promise<number | null> {
  const response = await fetchWithTimeout(`${origin}/cart/add.js`, {
    method: "POST",
    origin,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ id: variantId, quantity: engineConfig.shopifyProbeQuantity }],
    }),
    allowedStatuses: [200, 422, 404, 429],
  });

  if (response.status !== 422) return null;

  const data = (await response.json().catch(() => null)) as {
    description?: string;
  } | null;
  const description = data?.description ?? "";
  const match = description.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function scrapeShopify(storeUrl: string): Promise<ScrapeResult> {
  const origin = originOf(storeUrl);
  const products: ScrapedProduct[] = [];

  // Page through the JSON feed (cap pages to avoid runaway crawls).
  const collected: ShopifyProduct[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await fetchProductsPage(origin, page);
    if (batch.length === 0) break;
    collected.push(...batch);
    await jitter();
    if (collected.length >= engineConfig.maxProductsPerStore * 2) break;
  }

  const probeTargets = collected.slice(0, engineConfig.maxProductsPerStore);

  for (const product of collected) {
    const variant = product.variants?.[0];
    const willProbe = probeTargets.includes(product) && variant;

    let stock: number | null = null;
    if (willProbe) {
      try {
        stock = await probeShopifyStock(origin, variant.id);
      } catch {
        stock = null;
      }
      await jitter();
    }

    products.push({
      externalId: String(product.id),
      handle: product.handle,
      title: product.title,
      description: product.body_html
        ? product.body_html.replace(/<[^>]+>/g, "").trim().slice(0, 2000)
        : null,
      price: toNumber(variant?.price),
      compareAtPrice: toNumber(variant?.compare_at_price),
      currency: "DZD",
      imageUrl: product.images?.[0]?.src ?? null,
      productUrl: `${origin}/products/${product.handle}`,
      stock,
    });
  }

  return { platform: "shopify", storeUrl, products };
}
