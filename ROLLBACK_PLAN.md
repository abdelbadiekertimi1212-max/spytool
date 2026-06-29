# Rollback Plan

## Principle
Every risky change is **feature-flagged off by default** or **additive**, so rollback is
usually "flip a flag" or "promote the previous deploy" — not a data migration.

## App (Vercel)
- Deployments → promote the previous green build (instant, no data change).

## Feature flags (set in deploy env → redeploy)
| Flag | Default | Rollback |
|---|---|---|
| `ENABLE_PROXY` | `false` | keep `false` (scrapers run direct) |
| `ENABLE_IMAGE_REHOST` (Phase B) | `false` | set `false` → cards fall back to original image URLs |
| `ENABLE_QUEUE` (Phase C) | `false` | set `false` → cron orchestration remains authoritative |

## Database
- Migrations are additive/idempotent. To revert a policy/column, write a **new** down-migration (don't edit history). Catalog data is reproducible by the engine; use Supabase PITR only for true data loss.

## Paywall (if it over-blocks)
- Temporary: change the four catalog `*_read` policies' `using (private.has_active_subscription())` back to `using (true)` via a new migration. Preferred: fix the user's `subscriptions` row instead.

## E2E fixtures
- `tsx scripts/reset-test-env.ts --teardown` removes all `@e2e.test` users + the `E2E —` store (cascades). Safe; touches only marked rows.

## Queue (Phase C)
- Stop the worker; set `ENABLE_QUEUE=false`. The `pgboss` schema can be dropped (`drop schema pgboss cascade`) without touching app tables.

## Verify after any rollback
`npm run typecheck && npm run lint && npm test && npm run build`, then `GET /api/health` = 200.
