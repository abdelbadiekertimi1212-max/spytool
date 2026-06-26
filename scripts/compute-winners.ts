import "dotenv/config";

import { createEngineClient, computeWinners } from "../lib/engine";

/**
 * Winner pass: recompute daily_velocity from the snapshot history and toggle
 * is_winner where velocity AND active ad-backing both qualify. Run after the
 * inventory and ads passes.
 */
async function main() {
  const client = createEngineClient();
  const { processed, winners } = await computeWinners(client);
  console.log(
    `[winners] processed ${processed} products → ${winners} confirmed winners.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
