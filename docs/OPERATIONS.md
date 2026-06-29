# Operations Runbook

## Health & monitoring
- **Liveness/readiness:** `GET /api/health` → `200 healthy` / `503 degraded`, JSON `{ status, checks: { supabase, rateLimiter }, requestId }`. Point your uptime monitor here.
- **Ops dashboard:** `/dashboard/health` (auth-gated) — active stores/products/ads, errors in last 24h, last inventory scrape, and the most recent `engine_logs`.
- **Structured logs:** every Groq call logs `tokens` + `latency`; engine failures are written to the `engine_logs` table (service-role only) and to stdout as JSON lines (`lib/observability.ts`).

## The engine pipeline (GitHub Actions, every 6h)
Order: `discover → inventory(+niche tag) → classify → ads → winners`.
- Manual run: Actions tab → **Winner Engine** → *Run workflow*.
- Local run (needs `.env.local`): `npm run engine:discover|inventory|classify|ads|winners`, or `npm run engine:all`.
- Secrets required in repo: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ optional `GROQ_API_KEY`).

## Rate limiting
- Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (free tier) so limits are shared across serverless instances. Without them, an in-memory per-process fallback still blocks abusers locally.

## Scraping resilience (Phase 4, opt-in)
- Disabled by default. To enable proxy rotation: set `ENABLE_PROXY=true` and `PROXY_URLS=...` (operator-supplied). `BrowserPool` / `SessionPool` (`lib/engine/browser-pool.ts`) rotate fingerprints and sessions; `detectCaptcha()` flags soft-blocks.
- Keep the cron at **≤ every 6h** and concurrency-guarded to avoid IP bans.

## Database & migrations
- Migrations in `supabase/migrations/`. Apply via the **session pooler** (IPv4):
  `npx supabase db push --db-url "postgresql://postgres.<ref>:<pw>@aws-1-<region>.pooler.supabase.com:5432/postgres"`.
- The direct `db.<ref>.supabase.co` host is IPv6-only and won't resolve on IPv4 networks — always use the pooler.

## Deploy (Vercel, recommended)
1. Import the repo; framework auto-detected (Next.js).
2. Set env vars (see `.env.example`) — all `NEXT_PUBLIC_*` + server secrets.
3. Set `NEXT_PUBLIC_SITE_URL` to the production URL (Chargily success/webhook URLs derive from it).
4. Add the Chargily webhook endpoint `https://<domain>/api/webhooks/chargily` in the Chargily dashboard.

## Rollback
- App: Vercel → Deployments → promote the previous green deployment (instant).
- DB: migrations are additive/idempotent; to revert a policy/table, write a new down-migration (never edit an applied migration). Restore from Supabase PITR/backups if data loss.

## CI
- `.github/workflows/ci.yml`: parallel `quality` (typecheck/lint/build) + `test` (vitest + coverage gate). PRs must be green. Coverage gate: stmts/fns/lines ≥ 75%, branches ≥ 70%.

## End-to-end tests (Phase A)
- Run: `npm run test:e2e` (Playwright). `globalSetup` calls `reset-test-env` to provision deterministic fixtures; `globalTeardown` removes them (set `E2E_KEEP_DATA=true` to keep for debugging).
- Manually reset/clean fixtures: `tsx scripts/reset-test-env.ts` / `tsx scripts/reset-test-env.ts --teardown`.
- Needs a dev server (auto-started unless `E2E_BASE_URL` is set), Supabase reachable, and `SUPABASE_SERVICE_ROLE_KEY`.
- CI: gated/nightly `e2e.yml` (manual `workflow_dispatch` + 03:00 UTC). It is **not** a PR blocker — the PR gate is the unit/integration coverage job.
- Fixtures are isolated (`@e2e.test` emails, `E2E —` names) so they never collide with real data.

## Verify before shipping
`npm run typecheck && npm run lint && npm test && npm run build`
