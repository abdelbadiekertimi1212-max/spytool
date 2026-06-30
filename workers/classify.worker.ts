import { classifyAll } from "../lib/engine/classifier";
import { CONCURRENCY, QUEUE, type WorkerDef } from "../lib/queue/jobs";

/** Stage 3: drain the untagged-niche queue via Groq (rate-limit friendly). */
export const classifyWorker: WorkerDef = {
  name: QUEUE.classify,
  concurrency: CONCURRENCY.classify,
  run: async (client) => {
    await classifyAll(client, { chunkSize: 50, delayMs: 1500 });
  },
};
