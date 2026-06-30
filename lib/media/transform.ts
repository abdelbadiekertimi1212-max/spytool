import sharp from "sharp";

import { mediaConfig } from "./config";

export interface Variant {
  name: string;
  buffer: Buffer;
  width: number;
  height: number;
}

export interface TransformResult {
  variants: Variant[];
  /** Source intrinsic dimensions. */
  width: number;
  height: number;
}

/**
 * Generate thumbnail / card / full webp variants (quality 80, longest edge
 * capped, never upscaled). Metadata is dropped (sharp default). Throws on a
 * corrupt image (no decodable dimensions).
 */
export async function transformImage(buffer: Buffer): Promise<TransformResult> {
  const meta = await sharp(buffer, { failOn: "error" }).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Corrupt image: no decodable dimensions");
  }

  const variants: Variant[] = [];
  for (const [name, size] of Object.entries(mediaConfig.sizes)) {
    const { data, info } = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: mediaConfig.quality })
      .toBuffer({ resolveWithObject: true });
    variants.push({ name, buffer: data, width: info.width, height: info.height });
  }

  return { variants, width: meta.width, height: meta.height };
}
