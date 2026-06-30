import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine/supabase";
import { cleanupMedia } from "../lib/media/cleanup";

/** Remove failed/orphan media_assets (originals are never touched). */
async function main() {
  const client = createEngineClient();
  const r = await cleanupMedia(client);
  console.log(
    `[media-cleanup] failedRemoved=${r.failedRemoved} orphansRemoved=${r.orphansRemoved}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
