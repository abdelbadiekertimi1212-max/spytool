import { mediaConfig } from "./config";

/** Normalize a Content-Type header to its bare mime (drops charset/params). */
export function normalizeMime(contentType: string | null | undefined): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * Allowlist check. Rejects SVG (script vector), HTML, and anything not in the
 * raster allowlist — the core defense against SSRF/markup-injection via images.
 */
export function isAllowedMime(contentType: string | null | undefined): boolean {
  const mime = normalizeMime(contentType);
  if (!mime) return false;
  if (mime === "image/svg+xml") return false;
  if (mime.startsWith("text/") || mime.includes("html") || mime.includes("xml")) {
    return false;
  }
  return mediaConfig.allowedMime.includes(mime);
}

/** Reject oversized and corrupt/empty payloads. */
export function isAllowedSize(bytes: number): boolean {
  return bytes >= mediaConfig.minBytes && bytes <= mediaConfig.maxBytes;
}
