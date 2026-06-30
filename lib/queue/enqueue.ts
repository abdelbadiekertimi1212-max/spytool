import { getBoss } from "./boss";
import { QUEUE, JOB_OPTIONS, type JobName } from "./jobs";

/** Enqueue a single stage with its retry/backoff/timeout/dead-letter options. */
export async function enqueueJob(
  name: JobName,
  data: Record<string, unknown> = {}
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(name, data, JOB_OPTIONS[name]);
}

/**
 * Enqueue the head of the pipeline (`discover`). Each worker enqueues the next
 * stage on success, so the whole chain runs in order, resume-safe and
 * idempotent (singletonKey per stage dedupes concurrent enqueues).
 */
export async function enqueuePipeline(): Promise<string | null> {
  return enqueueJob(QUEUE.discover);
}
