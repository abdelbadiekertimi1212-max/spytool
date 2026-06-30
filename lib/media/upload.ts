import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";
import { mediaConfig } from "./config";

type Client = SupabaseClient<Database>;

/** Upload a buffer to the product-images bucket and return its public URL. */
export async function uploadVariant(
  client: Client,
  path: string,
  buffer: Buffer,
  contentType = "image/webp"
): Promise<string> {
  const { error } = await client.storage
    .from(mediaConfig.bucket)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return client.storage.from(mediaConfig.bucket).getPublicUrl(path).data.publicUrl;
}

export function publicUrl(client: Client, path: string): string {
  return client.storage.from(mediaConfig.bucket).getPublicUrl(path).data.publicUrl;
}
