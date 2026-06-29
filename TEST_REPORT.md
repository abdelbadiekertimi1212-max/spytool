# TEST REPORT — Phase 8 (Test Expansion)

**Date:** 29 June 2026 · **Runner:** Vitest 4 (v8 coverage) · **Status:** ✅ green

## Summary

| | Before | **After** |
|---|---|---|
| Test files | 3 | **14** |
| Tests | 14 | **59** |
| Coverage gate | none | **enforced in CI** |

## Coverage (critical-path scope)

Coverage is measured on the business-critical modules we own (engine math, billing,
validation, rate limiting, payments, subscription, and all API routes) — not on UI
components or browser-driven scrapers, which are covered by E2E.

| Metric | Result | Threshold | Status |
|---|---|---|---|
| Statements | **85.87%** | 75% | ✅ |
| Branches | **73.78%** | 70% | ✅ |
| Functions | **94.59%** | 75% | ✅ |
| Lines | **88.57%** | 75% | ✅ |

Per-file highlights: `chargily.ts` 95% · `winner.ts` 86% · API routes 89–94% · `ratelimit.ts` 74%.

## What is tested

### Unit (`tests/unit/`)
- **`computeVelocity`** — gradual-drop velocity, **rejection of ≥100 manual resets**, restock exclusion, null-stock handling, mixed series.
- **`normalizeTitle`** — punctuation stripping, Arabic preservation, cross-store grouping.
- **billing** — tier pricing, paid-tier guards.
- **validation** — all three zod schemas + `parseBody` (valid / invalid / malformed JSON).
- **ratelimit** — in-memory fallback blocks at the free budget (10/min), pro headroom, key isolation.
- **subscription** — active / trialing / expired / canceled / missing states.
- **chargily** — real HMAC-SHA256 signature verify (+ tamper rejection), metadata normalization, `createCheckout` success/error via mocked `fetch`.
- **classifier** — empty input, no-Groq fallback, **Groq output parsing + off-taxonomy coercion** (mocked SDK), backfill no-op safety.

### Integration (`tests/integration/`) — API route handlers
- `/api/checkout`, `/api/outreach`, `/api/outreach/send` — **401 unauth, 429 rate-limited, 400 invalid body, 200 success**.
- `/api/webhooks/chargily` — **403 bad signature, 400 malformed, 200 duplicate (replay protection), subscription upgrade on new `checkout.paid`**.
- `/api/remix-ad` — 401 / 501 scaffold contract.
- **`computeWinners`** — end-to-end through a Supabase mock: confirms a velocity+ad-backed product wins and a fast-mover without ad commitment does not.

### E2E (`tests/e2e/`) — Playwright (scaffolded)
- Landing renders, login reachable, **dashboard redirects unauthenticated → login**. Run with `npm run test:e2e` (needs a dev server; gated separately from the coverage job).

## Infrastructure
- `tests/{unit,integration,e2e,mocks,fixtures}` layout.
- `tests/mocks/supabase.ts` — chainable, thenable Supabase client mock (+ `rpc`).
- `vitest.config.ts` — `@/` + `server-only` aliases, v8 coverage with thresholds.
- CI (`.github/workflows/ci.yml`) — **parallel `quality` + `test` jobs**, npm cache, coverage gate, coverage artifact upload. CI fails if statements/functions/lines < 75% or branches < 70%.

## Known gaps (next)
- `ratelimit.ts` Upstash branch (32–41) is only hit when `UPSTASH_*` is set — covered implicitly in prod.
- `classifier.ts` `classifyUntagged` happy-path with a real Groq response is not yet integration-tested.
- E2E logged-in flows (checkout, logout) need a seeded test user.
