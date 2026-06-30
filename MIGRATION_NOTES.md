# Migration Notes

## Applying migrations
Use the **IPv4 session pooler** (the direct `db.<ref>.supabase.co` host is IPv6-only):
```
npx supabase db push --db-url "postgresql://postgres.<ref>:<pw>@aws-1-<region>.pooler.supabase.com:5432/postgres"
```
Migrations are append-only and idempotent where possible. **Never edit an applied migration** — add a new one.

## Applied (in order)
1. `20260626000001_init_schema.sql` — tables, enums, triggers, indexes, base RLS.
2. `20260627010000_add_product_niche.sql` — `products.niche` + index.
3. `20260627020000_hardening_rls_indexes.sql` — high-volume indexes, `bookmarks`, `engine_logs`, hardened RLS.
4. `20260629010000_paywall_and_webhook_idempotency.sql` — catalog RLS gated on `private.has_active_subscription()`; `processed_webhook_events`.

## Phase A — E2E environment
**No schema migration.** Test data is provisioned at runtime by `scripts/reset-test-env.ts`
(Auth admin API for users; service-role upserts for catalog). `supabase/seed-test.sql`
is the canonical catalog-fixture definition (kept in sync with the script).
Isolation markers: `@e2e.test` emails, `E2E —` names, `e2e0000…` UUIDs. Re-runnable & parallel-safe.

## Phase B — Image rehosting (APPLIED: `20260629030000_media_assets.sql`)
- Adds `products.image_rehosted_url`, the `media_assets` ledger (index on `product_id`, **unique** on `content_hash`), and the public `product-images` Storage bucket.
- **Version note:** `20260629020000` was already taken by `winner_metrics_rpc`, so this migration was bumped to `…030000`. Migration versions must be globally unique; check `ls supabase/migrations` before choosing a timestamp.
- No data backfill in the migration — rehosting runs via `npm run media:rehost` (idempotent: only products with a null `image_rehosted_url` are processed; dedupe by sha256).
- Rollback: serving falls back to the original URL automatically; to fully revert, drop `media_assets` + the column in a new migration and empty the bucket.

## Phase C — Engine queue (APPLIED: `20260629040000_queue_runs.sql`)
- Adds `queue_runs` (job-execution mirror; RLS on, no client policies → service-role only) read by `/dashboard/health/jobs`.
- **pg-boss owns its own `pgboss` schema** — it auto-creates/migrates on `boss.start()`; there is **no** Supabase migration for the queue internals (don't hand-write one). Rollback = `drop schema pgboss cascade;` (never touches app tables).
- Flag-gated by `ENABLE_QUEUE` (default false → cron unchanged). Needs `QUEUE_DATABASE_URL` (session pooler) on the worker.

## Upcoming (planned, not yet applied)
- **Phase C (queue):** `pg-boss` creates its own `pgboss` schema on first boot (no manual migration). Flag `ENABLE_QUEUE`.
- **Phase D (Phase-6 foundations):** `analytics_events`, `usage_counters`, `referrals`, `crm_enrichment` tables + RLS (owner-read; service-role write).
