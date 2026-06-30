# Queue Operations (Phase C — pg-boss)

## Model
Durable orchestration on the **existing Supabase Postgres** (pg-boss owns a `pgboss`
schema). The pipeline is the same five stages, now resilient: **discover → inventory
→ classify → ads → winners**. Each stage, on success, enqueues the next (resume-safe
chain); on failure it retries with backoff and, when exhausted, dead-letters to
`engine.dlq`.

**Default is OFF.** With `ENABLE_QUEUE` unset/false, nothing changes — the GitHub
Actions cron runs the engine scripts exactly as before. The queue is opt-in.

## Enable
Set on the worker host + scheduler:
```
ENABLE_QUEUE=true
QUEUE_DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-1-<region>.pooler.supabase.com:5432/postgres   # session pooler
# optional concurrency overrides (defaults shown)
QUEUE_CONC_DISCOVER=1  QUEUE_CONC_INVENTORY=3  QUEUE_CONC_CLASSIFY=2  QUEUE_CONC_ADS=2  QUEUE_CONC_WINNERS=1
```

## Run
| Command | Purpose |
|---|---|
| `npm run queue:work` | Long-lived worker process (registers all stages, processes jobs). Deploy on a free always-on host (Fly.io / Render free web service or a small VM). |
| `npm run queue:enqueue` | Enqueue the pipeline head (`discover`); the chain runs the rest. Point a scheduler (cron, GH Actions, or `pg-boss` schedule) at this. |
| `npm run queue:status` | Per-queue `ready/active/failed/total`. |
| `npm run queue:replay` | Redrive failed jobs across the pipeline (DLQ recovery). |
| `npm run queue:drain` | Delete queued (not-yet-started) jobs. |
| `tsx scripts/queue.ts cancel <name> <id>` / `retry <name> <id>` | Operate on a single job. |

## Dashboard
`/dashboard/health/jobs` shows per-stage last status, running count, failures and avg
duration (from the `queue_runs` mirror). Live queue depth/DLQ counts: `npm run queue:status`.

## Job semantics
- **Retry/backoff/timeout:** see `lib/queue/jobs.ts` `JOB_OPTIONS` (retryLimit, retryDelay, retryBackoff, expireInSeconds).
- **Concurrency:** `localConcurrency` per stage (env-overridable).
- **Idempotency:** `singletonKey` per stage prevents duplicate concurrent enqueues.
- **Dead letter:** `engine.dlq`; recover with `queue:replay`.
- **Pause/resume:** stop/start the `queue:work` process (pg-boss has no global pause).

## Rollback
`ENABLE_QUEUE=false` (cron resumes immediately). The whole subsystem is droppable with
`drop schema pgboss cascade;` — it never touches app tables. `queue_runs` is additive.

## Cron coexistence
Do **not** run both the cron scripts and `queue:enqueue` against the same data
simultaneously. Pick one orchestrator: cron (`ENABLE_QUEUE=false`) **or** queue
(`ENABLE_QUEUE=true` + worker + scheduler). The GitHub Actions `engine.yml` cron is the
default and is left unchanged.
