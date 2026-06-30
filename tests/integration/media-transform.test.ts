import { describe, it, expect } from "vitest";
import sharp from "sharp";

import { transformImage } from "@/lib/media/transform";
import { sanitizeImage } from "@/lib/media/sanitize";

// A real (tiny) PNG so we exercise sharp end-to-end without any network.
async function makePng(size = 50): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 10, g: 200, b: 120 } },
  })
    .png()
    .toBuffer();
}

describe("transformImage", () => {
  it("produces thumb/card/full webp variants, never upscaled", async () => {
    const png = await makePng(50);
    const { variants, width, height } = await transformImage(png);

    expect(width).toBe(50);
    expect(height).toBe(50);
    expect(variants.map((v) => v.name).sort()).toEqual(["card", "full", "thumb"]);

    for (const v of variants) {
      // WEBP magic bytes: "RIFF"...."WEBP".
      expect(v.buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(v.buffer.subarray(8, 12).toString("ascii")).toBe("WEBP");
      // withoutEnlargement: a 50px source is never upscaled to 800/1600.
      expect(v.width).toBeLessThanOrEqual(50);
    }
  });

  it("downsizes a large image within the cap", async () => {
    const big = await makePng(3000);
    const { variants } = await transformImage(big);
    const full = variants.find((v) => v.name === "full")!;
    expect(full.width).toBeLessThanOrEqual(1600);
  });

  it("rejects a corrupt buffer", async () => {
    await expect(transformImage(Buffer.from("not-an-image"))).rejects.toBeTruthy();
  });

  it("sanitizeImage returns a decodable image", async () => {
    const out = await sanitizeImage(await makePng(30));
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(30);
  });
});
