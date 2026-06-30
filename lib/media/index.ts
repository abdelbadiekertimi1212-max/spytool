import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { downloadImage } from "./download";
import { transformImage } from "./transform";
import { sha256 } from "./hash";
import { uploadVariant, publicUrl } from "./upload";

type Client = SupabaseClient<Database>;

export type IngestStatus = "rehosted" | "deduped" | "failed";
export interface IngestResult {
  status: IngestStatus;
  url?: string;
  hash?: string;
  bytesIn?: number;
  bytesOut?: number;
  reason?: string;
}

/**
 * Full ingestion for one product image:
 *   download → validate → transform(webp variants) → sha256 dedupe → upload →
 *   record media_asset → set products.image_rehosted_url.
 * Never throws — returns a `failed` result and records a failed asset so the
 * scraper/worker keeps going and cleanup can retry later.
 */
export async function ingestProductImage(
  client: Client,
  productId: string,
  sourceUrl: string
): Promise<IngestResult> {
  try {
    const dl = await downloadImage(sourceUrl);
    const hash = sha256(dl.buffer);

    // Dedupe: identical bytes already rehosted → reuse, no transform/upload.
    const { data: existing } = await client
      .from("media_assets")
      .select("storage_path")
      .eq("content_hash", hash)
      .maybeSingle();
    if (existing?.storage_path) {
      const url = publicUrl(client, existing.storage_path);
      await client.from("products").update({ image_rehosted_url: url }).eq("id", productId);
      return { status: "deduped", url, hash, bytesIn: dl.bytes };
    }

    const { variants } = await transformImage(dl.buffer);
    const card = variants.find((v) => v.name === "card") ?? variants[0];
    let cardUrl = "";
    let bytesOut = 0;
    for (const v of variants) {
      const path = `products/${productId}/${v.name}.webp`;
      const url = await uploadVariant(client, path, v.buffer);
      bytesOut += v.buffer.byteLength;
      if (v.name === "card") cardUrl = url;
    }
    const cardPath = `products/${productId}/card.webp`;

    await client.from("media_assets").insert({
      product_id: productId,
      source_url: sourceUrl,
      storage_path: cardPath,
      content_hash: hash,
      mime: "image/webp",
      width: card.width,
      height: card.height,
      size_bytes: card.buffer.byteLength,
      status: "ready",
    });
    await client.from("products").update({ image_rehosted_url: cardUrl }).eq("id", productId);

    return { status: "rehosted", url: cardUrl, hash, bytesIn: dl.bytes, bytesOut };
  } catch (err) {
    // Best-effort failed-asset record (ignored if it conflicts).
    await client
      .from("media_assets")
      .insert({
        product_id: productId,
        source_url: sourceUrl,
        content_hash: `failed:${productId}:${Date.now()}`,
        status: "failed",
      })
      .then(() => undefined, () => undefined);
    return { status: "failed", reason: (err as Error).message };
  }
}

export { getProductImage, isRehosted, PLACEHOLDER_IMAGE } from "./serve";
