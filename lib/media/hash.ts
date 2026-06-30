import { createHash } from "node:crypto";

/** Content-addressable sha256 of an image buffer (hex). Used for dedup. */
export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
