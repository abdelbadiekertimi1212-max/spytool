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

## Upcoming (planned, not yet applied)
- **Phase B (images):** `media_assets` dedupe table (hash PK: url, width, height, mime, bytes) + a public `product-images` storage bucket + storage read policy. Flag `ENABLE_IMAGE_REHOST`.
- **Phase C (queue):** `pg-boss` creates its own `pgboss` schema on first boot (no manual migration). Flag `ENABLE_QUEUE`.
- **Phase D (Phase-6 foundations):** `analytics_events`, `usage_counters`, `referrals`, `crm_enrichment` tables + RLS (owner-read; service-role write).
