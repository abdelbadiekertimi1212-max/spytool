import "../lib/engine/load-env";

import { getBoss, queueEnabled, stopBoss } from "../lib/queue/boss";
import { registerWorkers } from "../lib/queue/workers";
import { enqueuePipeline } from "../lib/queue/enqueue";
import { DLQ, PIPELINE } from "../lib/queue/jobs";

/**
 * Queue control CLI. `npm run queue:<cmd>`:
 *   work     — boot pg-boss + run all stage workers (long-lived process)
 *   enqueue  — enqueue the pipeline head (discover); the chain runs the rest
 *   status   — print ready/active/failed/total per queue
 *   replay   — redrive failed jobs across the pipeline (DLQ recovery)
 *   drain    — delete queued (not-yet-started) jobs
 *   cancel/retry <name> <id> — operate on a single job
 */
async function main() {
  const cmd = process.argv[2] ?? "help";

  if (cmd === "help") {
    console.log("usage: queue <work|enqueue|status|replay|drain|cancel|retry>");
    return;
  }
  if (!queueEnabled()) {
    console.log(
      "[queue] ENABLE_QUEUE!=true — queue disabled; cron remains authoritative. Set ENABLE_QUEUE=true to use it."
    );
    return;
  }

  const boss = await getBoss();
  try {
    switch (cmd) {
      case "work": {
        await registerWorkers(boss);
        console.log("[queue] workers running (Ctrl-C to stop)…");
        await new Promise<void>((resolve) => {
          process.on("SIGINT", resolve);
          process.on("SIGTERM", resolve);
        });
        break;
      }
      case "enqueue": {
        const id = await enqueuePipeline();
        console.log(`[queue] enqueued discover (job ${id})`);
        break;
      }
      case "status": {
        const queues = await boss.getQueues([...PIPELINE, DLQ]);
        for (const q of queues) {
          console.log(
            `${q.name}: ready=${q.readyCount} active=${q.activeCount} failed=${q.failedCount} total=${q.totalCount}`
          );
        }
        break;
      }
      case "replay": {
        let total = 0;
        for (const n of PIPELINE) total += await boss.redrive(n);
        console.log(`[queue] redrove ${total} failed jobs across the pipeline`);
        break;
      }
      case "drain": {
        for (const n of PIPELINE) await boss.deleteQueuedJobs(n);
        console.log("[queue] drained queued jobs");
        break;
      }
      case "cancel": {
        await boss.cancel(process.argv[3], process.argv[4]);
        console.log("[queue] cancelled");
        break;
      }
      case "retry": {
        await boss.retry(process.argv[3], process.argv[4]);
        console.log("[queue] retried");
        break;
      }
      default:
        console.log(`unknown command: ${cmd}`);
    }
  } finally {
    await stopBoss();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
