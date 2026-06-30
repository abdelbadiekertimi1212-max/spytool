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

## Growth foundations (Phase D)
- All Phase-D tables are **additive and dormant**. Disable behavior with flags: `ENABLE_ANALYTICS=false` (stops event writes), `ENABLE_USAGE_LIMITS=false` (checks allow-all — default), `ENABLE_REFERRALS=false`, `ENABLE_CRM=false`.
- The collector is fire-and-forget; removing the single webhook `trackServer(...)` call fully reverts the only wiring with zero contract impact.
- To drop schema (only if truly needed): new down-migration dropping `analytics_events`, `usage_counters`, `referrals`, `crm_enrichment`, `limit_rules` + `drop function public.increment_usage(...)`. No app table depends on them, so this is safe.

## Activation / onboarding (Phase 6.1)
- Onboarding is **non-blocking** — hide the prompt by reverting the dashboard `OnboardingCard` render (one conditional) or treat all users as onboarded; nothing gates access, so there is no lockout to undo.
- Bookmarks + onboarding are additive owner-RLS features. Disable analytics with `ENABLE_ANALYTICS=false`.
- Schema revert (only if needed): new down-migration dropping the four `profiles` onboarding columns. The `bookmarks` table predates this phase and is unaffected.

## Verify after any rollback
`npm run typecheck && npm run lint && npm test && npm run build`, then `GET /api/health` = 200.
