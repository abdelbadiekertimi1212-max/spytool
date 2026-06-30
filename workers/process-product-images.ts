import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine/supabase";
import { ingestProductImage } from "../lib/media";
import { mediaConfig } from "../lib/media/config";
import { sleep } from "../lib/engine/http";

/**
 * Rehost product images into Supabase Storage. Processes products that have an
 * external image_url but no image_rehosted_url yet. Gated by ENABLE_IMAGE_REHOST.
 * Usage: npm run media:rehost [limit]
 */
async function main() {
  if (!mediaConfig.enabled) {
    console.log("[media] ENABLE_IMAGE_REHOST=false — skipping.");
    return;
  }
  const limit = Number(process.argv[2]) || (mediaConfig.backfill ? 1000 : 200);
  const client = createEngineClient();

  const { data: products, error } = await client
    .from("products")
    .select("id, image_url")
    .is("image_rehosted_url", null)
    .not("image_url", "is", null)
    .limit(limit);
  if (error) throw new Error(error.message);

  const list = products ?? [];
  let rehosted = 0;
  let deduped = 0;
  let failed = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  for (const p of list) {
    const r = await ingestProductImage(client, p.id, p.image_url as string);
    if (r.status === "rehosted") {
      rehosted += 1;
      bytesIn += r.bytesIn ?? 0;
      bytesOut += r.bytesOut ?? 0;
    } else if (r.status === "deduped") {
      deduped += 1;
    } else {
      failed += 1;
    }
    await sleep(150);
  }

  const reduction = bytesIn > 0 ? (1 - bytesOut / bytesIn) * 100 : 0;
  console.log(
    `[media] processed=${list.length} rehosted=${rehosted} deduped=${deduped} ` +
      `failed=${failed} bytesIn=${bytesIn} bytesOut=${bytesOut} reduction=${reduction.toFixed(1)}%`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
