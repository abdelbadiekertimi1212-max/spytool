import sharp from "sharp";

/**
 * Decode and re-encode the image, which strips ALL metadata/EXIF/ICC and any
 * trailing/unsafe payload (sharp never copies metadata unless `withMetadata()`
 * is called). `.rotate()` bakes EXIF orientation before the orientation tag is
 * dropped. Throws on a corrupt/undecodable buffer.
 */
export async function sanitizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: "error" })
    .rotate()
    .toBuffer();
}
