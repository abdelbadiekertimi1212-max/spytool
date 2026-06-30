import { mediaConfig } from "./config";
import { isAllowedMime, isAllowedSize, normalizeMime } from "./validate";

export interface DownloadedImage {
  buffer: Buffer;
  mime: string;
  bytes: number;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Fetch a remote image with a timeout, a bounded redirect chain, content-type
 * allowlisting and a hard size cap. Throws (caller treats as a failed asset) on
 * disallowed type (svg/html), oversize, corrupt/empty, or transport error.
 */
export async function downloadImage(url: string): Promise<DownloadedImage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), mediaConfig.timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= mediaConfig.maxRedirects; hop += 1) {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": UA, Accept: "image/*" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error(`Redirect ${res.status} without location`);
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const mime = normalizeMime(res.headers.get("content-type"));
      if (!isAllowedMime(mime)) throw new Error(`Disallowed content-type: ${mime || "unknown"}`);

      const declared = Number(res.headers.get("content-length") || 0);
      if (declared && !isAllowedSize(declared)) throw new Error(`Declared size out of range: ${declared}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      if (!isAllowedSize(buffer.byteLength)) {
        throw new Error(`Payload size out of range: ${buffer.byteLength}`);
      }
      return { buffer, mime, bytes: buffer.byteLength };
    }
    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}
