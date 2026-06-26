import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";

const PLATFORMS = ["shopify", "youcan", "storeino"] as const;
type Platform = (typeof PLATFORMS)[number];

/**
 * Register a store to track.
 * Usage:
 *   tsx scripts/seed-stores.ts <store_url> <shopify|youcan|storeino> [fb_page_id] [fb_page_name]
 */
async function main() {
  const [url, platform, fbPageId, fbPageName] = process.argv.slice(2);

  if (!url || !platform) {
    console.error(
      "Usage: tsx scripts/seed-stores.ts <store_url> <shopify|youcan|storeino> [fb_page_id] [fb_page_name]"
    );
    process.exit(1);
  }
  if (!PLATFORMS.includes(platform as Platform)) {
    console.error(
      `Invalid platform '${platform}'. Must be one of: ${PLATFORMS.join(", ")}`
    );
    process.exit(1);
  }

  const parsed = new URL(url);
  const client = createEngineClient();

  const { data, error } = await client
    .from("stores")
    .upsert(
      {
        url: parsed.origin,
        domain: parsed.host,
        platform: platform as Platform,
        fb_page_id: fbPageId ?? null,
        fb_page_name: fbPageName ?? null,
        is_active: true,
      },
      { onConflict: "url" }
    )
    .select("id, url")
    .single();

  if (error) throw new Error(error.message);
  console.log(`[seed] upserted store ${data.url} (${data.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
