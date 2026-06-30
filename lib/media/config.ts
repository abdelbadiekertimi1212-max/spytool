/** Media ingestion tuning. Env-overridable so the worker can be adjusted in CI. */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const mediaConfig = {
  /** Master switch for the ingestion worker (serving fallback always works). */
  enabled: process.env.ENABLE_IMAGE_REHOST !== "false", // default ON
  /** Bulk one-time backfill of the whole catalog — opt-in. */
  backfill: process.env.ENABLE_IMAGE_BACKFILL === "true",
  bucket: "product-images",
  maxBytes: num("MEDIA_MAX_BYTES", 8_000_000), // 8 MB hard cap
  minBytes: 100, // anything smaller is corrupt/garbage
  maxDimension: 1600, // "full" variant longest edge
  quality: 80,
  timeoutMs: num("MEDIA_TIMEOUT_MS", 20_000),
  maxRedirects: 3,
  /** Allowed source content types. SVG/HTML are intentionally excluded. */
  allowedMime: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ],
  /** Output variant longest-edge sizes (px). */
  sizes: { thumb: 300, card: 800, full: 1600 } as Record<string, number>,
};
