# Changelog

All notable production-hardening changes. Newest first.

## [Unreleased]

### Phase A — Real E2E Environment (29 Jun 2026)
- `supabase/seed-test.sql` + `scripts/reset-test-env.ts`: deterministic, isolated, re-runnable fixtures — active subscriber / expired / admin users (Auth admin API) + seeded stores/products/ads/snapshots (markers: `@e2e.test`, `E2E —`, fixed UUIDs).
- Playwright: `globalSetup`/`globalTeardown` (reset/teardown), `auth.setup.ts` storage-state project, scenario specs — auth, dashboard, paywall, checkout, outreach, logout (bookmark `fixme` until Phase 6 UI).
- `npm run test:e2e`; gated nightly/manual `e2e.yml` workflow (not a PR blocker). `.auth/` + reports gitignored. Unit/integration coverage unchanged (73 tests, 84%/74%).

### Phase 7 — Observability + Phase 4 — Scraping Resilience (29 Jun 2026)
- **`GET /api/health`** (Supabase + rate-limiter checks, 200/503) and **`/dashboard/health`** ops page (KPIs, 24h error count, last scrape, recent `engine_logs`).
- Structured JSON logger + request ids (`lib/observability.ts`). `docs/OPERATIONS.md` + `docs/INCIDENTS.md` runbooks.
- Scraping resilience **infrastructure (disabled by default, `ENABLE_PROXY=false`)**: `ProxyProvider` (round-robin), `BrowserPool`, `SessionPool` (fingerprint + session rotation), `detectCaptcha()`. No paid proxies bundled.

### Phase 5 — AI Reliability (29 Jun 2026)
- `lib/engine/resilience.ts`: `withRetry` (exponential backoff + jitter), `withTimeout`, `CircuitBreaker`. 95% covered.
- Groq calls (classifier + outreach) now wrapped with **retry + 20s timeout**; responses validated with **zod `safeParse`** (structured-output enforcement, no throw on drift).
- **Token-usage + latency logging** on every Groq call. `scripts/eval-classifier.ts` (+ `npm run eval:classifier`) reports accuracy / latency / failure rate on a labeled set.

### Phase 8 — Test Expansion (29 Jun 2026)
- Added Vitest + v8 coverage; **14 → 59 tests** across `tests/{unit,integration,e2e,mocks}`.
- Coverage gate enforced in CI (statements/functions/lines ≥ 75%, branches ≥ 70%); achieved **85.9 / 73.8 / 94.6 / 88.6**.
- Supabase mock layer; integration tests for all API routes; `computeWinners` driven end-to-end.
- Playwright E2E scaffold (auth/paywall smoke). CI split into parallel `quality` + `test` jobs with coverage artifact upload.

### Phase 2 — Critical fixes (`08416c2`)
- Re-enabled the **subscription paywall** (RLS `has_active_subscription()` on catalog + server-side `getSubscriptionState` gate + `UpsellGate`).
- **zod validation** on every API route; **Chargily webhook idempotency** (`processed_webhook_events`) + HMAC verify.
- **Upstash + in-memory** tiered rate limiting on `/api/outreach`, `/api/outreach/send`, `/api/checkout`.

### Phase 3 — Performance (`8f891c1`)
- `computeWinners` batched via a single SQL RPC: **9 min → ~21 s**; 100-id snapshot batches.
- Lazy-loaded Recharts: dashboard First-Load JS **284 → 173 kB**; loading skeleton.

### Phase 7 — CI (partial)
- `.github/workflows/ci.yml`: typecheck + lint + test + build on Node 24.
- Engine cron hardened to 6h, detached, non-overlapping.

### Earlier
- Phases 1–5 of the original build: schema + RLS, Crawlee/Playwright engines, Meta Ad Library scraper, Groq niche classifier, OSINT analytics, Chargily payments, auto-discovery engine, master documentation.
