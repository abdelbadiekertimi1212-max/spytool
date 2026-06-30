import type { SendOptions } from "pg-boss";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";

/** The five engine stages, run in this exact order (preserves cron pipeline). */
export const QUEUE = {
  discover: "discover",
  inventory: "inventory",
  classify: "classify",
  ads: "ads",
  winners: "winners",
} as const;

export type JobName = (typeof QUEUE)[keyof typeof QUEUE];

/** A stage worker: its queue name, concurrency, and the task it runs. */
export interface WorkerDef {
  name: JobName;
  concurrency: number;
  run: (
    client: SupabaseClient<Database>,
    data: Record<string, unknown>
  ) => Promise<void>;
}

/** Shared dead-letter queue for all stages. */
export const DLQ = "engine.dlq";

export const PIPELINE: JobName[] = [
  QUEUE.discover,
  QUEUE.inventory,
  QUEUE.classify,
  QUEUE.ads,
  QUEUE.winners,
];

/** Next stage after `name`, or null at the tail (drives the resume-safe chain). */
export function nextJob(name: JobName): JobName | null {
  const i = PIPELINE.indexOf(name);
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null;
}

function num(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Per-stage worker concurrency (config-driven via env). */
export const CONCURRENCY: Record<JobName, number> = {
  discover: num("QUEUE_CONC_DISCOVER", 1),
  inventory: num("QUEUE_CONC_INVENTORY", 3),
  classify: num("QUEUE_CONC_CLASSIFY", 2),
  ads: num("QUEUE_CONC_ADS", 2),
  winners: num("QUEUE_CONC_WINNERS", 1),
};

/** Per-stage retry/backoff/timeout (expireInSeconds = job timeout). */
export const JOB_OPTIONS: Record<JobName, SendOptions> = {
  discover: { retryLimit: 2, retryDelay: 60, retryBackoff: true, expireInSeconds: 1800, singletonKey: "discover", deadLetter: DLQ },
  inventory: { retryLimit: 3, retryDelay: 60, retryBackoff: true, expireInSeconds: 3000, singletonKey: "inventory", deadLetter: DLQ },
  classify: { retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800, singletonKey: "classify", deadLetter: DLQ },
  ads: { retryLimit: 2, retryDelay: 60, retryBackoff: true, expireInSeconds: 2400, singletonKey: "ads", deadLetter: DLQ },
  winners: { retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 900, singletonKey: "winners", deadLetter: DLQ },
};
