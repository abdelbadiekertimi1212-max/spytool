import { discoverStores } from "../lib/engine";
import { engineConfig } from "../lib/engine/config";
import { CONCURRENCY, QUEUE, type WorkerDef } from "../lib/queue/jobs";

/** Stage 1: broad Ad-Library discovery → seed new stores. */
export const discoverWorker: WorkerDef = {
  name: QUEUE.discover,
  concurrency: CONCURRENCY.discover,
  run: async (client) => {
    await discoverStores(client, engineConfig.discover.keywords);
  },
};
