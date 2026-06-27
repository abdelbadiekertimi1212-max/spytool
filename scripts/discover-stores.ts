import "../lib/engine/load-env";

import { createEngineClient, discoverStores } from "../lib/engine";
import { engineConfig } from "../lib/engine/config";

/**
 * Auto-Discovery pass: hunt the public Meta Ad Library with broad Algerian-COD
 * keywords, detect the platform of each advertiser's landing page, and insert
 * brand-new Shopify/YouCan/Storeino stores. The inventory + winner crons then
 * pick them up automatically — a self-feeding loop.
 *
 * Usage:
 *   npm run engine:discover                      # uses default keywords
 *   npm run engine:discover -- "الدفع عند الاستلام"   # one custom keyword
 */
async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  const keywords = args.length > 0 ? args : engineConfig.discover.keywords;

  const client = createEngineClient();
  console.log(`[discover] keywords: ${keywords.map((k) => `"${k}"`).join(", ")}`);

  const summary = await discoverStores(client, keywords);

  console.log(
    `[discover] DONE — candidates=${summary.candidates} detected=${summary.detected} inserted=${summary.inserted}`
  );
  if (summary.insertedStores.length > 0) {
    console.log("[discover] new stores:");
    for (const s of summary.insertedStores) {
      console.log(`  • [${s.platform}] ${s.host}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
