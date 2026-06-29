import "../lib/engine/load-env";

import { createEngineClient } from "../lib/engine";
import { classifyAll } from "../lib/engine/classifier";

/**
 * Backfill niche tags for EVERY untagged product, looping in safe chunks with a
 * delay between each (Groq rate-limit friendly) until the queue is empty.
 * Usage: npm run engine:classify [chunkSize] [delayMs]
 */
async function main() {
  const chunkSize = Number(process.argv[2]) || 50;
  const delayMs = Number(process.argv[3]) || 1500;

  const client = createEngineClient();
  console.log(
    `[classify] draining untagged queue (chunk=${chunkSize}, delay=${delayMs}ms)…`
  );

  const tagged = await classifyAll(client, {
    chunkSize,
    delayMs,
    onProgress: (total) => console.log(`[classify] tagged ${total} so far…`),
  });

  console.log(`[classify] done — tagged ${tagged} products total. Queue empty.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
