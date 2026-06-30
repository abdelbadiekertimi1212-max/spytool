import { computeWinners } from "../lib/engine";
import { CONCURRENCY, QUEUE, type WorkerDef } from "../lib/queue/jobs";

/** Stage 5: recompute velocity + is_winner + lead_score (3D verification). */
export const winnersWorker: WorkerDef = {
  name: QUEUE.winners,
  concurrency: CONCURRENCY.winners,
  run: async (client) => {
    await computeWinners(client);
  },
};
