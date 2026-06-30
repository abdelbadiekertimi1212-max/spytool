import type { PgBoss, Job } from "pg-boss";

import { createEngineClient } from "../engine/supabase";
import { DLQ, JOB_OPTIONS, nextJob, type WorkerDef } from "./jobs";
import { recordRunStart, recordRunEnd } from "./metrics";
import { discoverWorker } from "../../workers/discover.worker";
import { inventoryWorker } from "../../workers/inventory.worker";
import { classifyWorker } from "../../workers/classify.worker";
import { adsWorker } from "../../workers/ads.worker";
import { winnersWorker } from "../../workers/winners.worker";

export const WORKERS: WorkerDef[] = [
  discoverWorker,
  inventoryWorker,
  classifyWorker,
  adsWorker,
  winnersWorker,
];

/**
 * Create every queue (+ shared DLQ) and register a worker per stage. On success
 * each stage records a completed run and enqueues the next stage (the resume-safe
 * chain); on failure it records the failure and rethrows so pg-boss applies the
 * configured retry/backoff and, when exhausted, routes the job to the DLQ.
 */
export async function registerWorkers(boss: PgBoss): Promise<void> {
  await boss.createQueue(DLQ);
  for (const w of WORKERS) {
    await boss.createQueue(w.name, { deadLetter: DLQ });
  }

  for (const w of WORKERS) {
    await boss.work(w.name, { localConcurrency: w.concurrency }, async (jobs: Job[]) => {
      for (const job of jobs) {
        const client = createEngineClient();
        const run = await recordRunStart(client, w.name);
        try {
          await w.run(client, (job.data ?? {}) as Record<string, unknown>);
          await recordRunEnd(client, run, "completed");
          const next = nextJob(w.name);
          if (next) await boss.send(next, {}, JOB_OPTIONS[next]);
        } catch (err) {
          await recordRunEnd(client, run, "failed", (err as Error).message);
          throw err; // pg-boss handles retry/backoff → DLQ
        }
      }
    });
  }
}
