import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";

/** Delete all DEMO-seeded stores (cascades to products / snapshots / ads). */
async function main() {
  const client = createEngineClient();
  const { data, error } = await client
    .from("stores")
    .delete()
    .like("name", "DEMO —%")
    .select("id, name");
  if (error) throw new Error(error.message);
  console.log(`[wipe-demo] deleted ${data?.length ?? 0} DEMO stores (cascaded to products/ads/snapshots).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
