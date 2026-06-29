import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";
import { classifyUntagged } from "../lib/engine/classifier";

/**
 * Backfill niche tags for every product that doesn't have one yet, using the
 * Groq/Llama-3 classifier (batched). Usage: npm run engine:classify [max]
 */
async function main() {
  const max = Number(process.argv[2]) || 600;
  const client = createEngineClient();
  console.log(`[classify] tagging up to ${max} untagged products…`);
  const tagged = await classifyUntagged(client, max);
  console.log(`[classify] done — tagged ${tagged} products.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
