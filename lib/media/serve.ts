/**
 * Client-safe image resolver. NO node/sharp imports — importable from React
 * Client Components. Resolution order: rehosted Storage URL → original scraped
 * URL → local placeholder. Guarantees a renderable src so the UI never breaks.
 */
export const PLACEHOLDER_IMAGE = "/placeholder-product.svg";

export interface ImageSource {
  image_rehosted_url?: string | null;
  image_url?: string | null;
}

export function getProductImage(product: ImageSource | null | undefined): string {
  return (
    product?.image_rehosted_url ||
    product?.image_url ||
    PLACEHOLDER_IMAGE
  );
}

/** True when we're serving the rehosted (trusted, cached) asset. */
export function isRehosted(product: ImageSource | null | undefined): boolean {
  return Boolean(product?.image_rehosted_url);
}
