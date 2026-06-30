-- =============================================================================
-- Phase C: durable engine orchestration (pg-boss).
--
-- pg-boss owns its own `pgboss` schema (auto-created on boss.start()); this
-- migration only adds `queue_runs` — a lightweight, Supabase-readable mirror of
-- job executions that the workers write (service-role) and the
-- /dashboard/health/jobs page reads (admin client). Mirrors the engine_logs
-- pattern: RLS on, NO client policies → service-role only.
-- Additive + idempotent. Flag-gated by ENABLE_QUEUE; cron is unaffected.
-- =============================================================================

create table if not exists public.queue_runs (
  id          uuid primary key default gen_random_uuid(),
  job_name    text not null,
  status      text not null default 'active', -- active | completed | failed
  attempt     integer not null default 1,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_queue_runs_job_time on public.queue_runs (job_name, created_at desc);
create index if not exists idx_queue_runs_status on public.queue_runs (status);

alter table public.queue_runs enable row level security;
-- No client policies → only the service_role (workers + admin dashboard) access it.
