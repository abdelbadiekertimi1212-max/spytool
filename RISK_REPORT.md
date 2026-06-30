# Risk Report

**Date:** 30 Jun 2026 (Phase 6.1) · **Risk score:** **~22 / 100** · **Production readiness:** **~88 / 100**

## Phase 6.2 — Usage Limits (delta)
- **Activation protected:** enforcement is rollout-gated (default off) and free/trial users have no rule → unlimited. Starter limits are generous vs. the first-bookmark activation milestone. **No lockouts** (soft→grace→hard, always a clear 429 + upgrade path).
- Reversible instantly: `ENABLE_USAGE_LIMITS=false` or `LIMITS_ROLLOUT=0`. Sticky buckets mean monotonic rollout never flips a user out.
- Coverage **increased** (86.3%/75.2%); typecheck/lint/build green; payments/queue/engine/RLS untouched. **Readiness ~89, risk ~21.**

## Phase 6.1 — Activation (delta)
- **Regression risk: low/none.** Onboarding is non-blocking (soft card, no hard redirect) → existing dashboard + E2E flows unchanged. Bookmarks/onboarding are owner-RLS scoped. Analytics collection is fire-and-forget + flag-gated (`ENABLE_ANALYTICS`). Payments/queue/engine/RLS untouched.
- New API routes validate input (zod) + require auth + tested for 401/400/200.
- Coverage maintained (84.9% stmts / 73.9% branch, above the 75/70 gate); typecheck/lint/build green.
- Residual: activation metrics (Time-To-First-Winner, activation %) require the analytics_events data to accumulate before the Phase 8 exec dashboard can report them.

---

**Date:** 29 Jun 2026 · **Risk score:** **24 / 100** (down from 38) · **Production readiness:** **~86 / 100**

## Resolved this session
| Was | Now |
|---|---|
| Paywall not enforced | RLS gate + app `getSubscriptionState` + upsell; **tested** |
| Unvalidated API inputs | zod `safeParse` on all routes; **tested** |
| Webhook replayable | idempotency table + HMAC verify; **tested** |
| Rate limit weak on serverless | Upstash configured + in-memory fallback; **tested** |
| AI calls could hang/throw | retry + 20s timeout + zod structured output; **tested** |
| ~15% test coverage, no gate | 73 tests, **84% stmts / 74% branches**, CI gate |
| No health/observability | `/api/health`, `/dashboard/health`, JSON logs, `engine_logs` |
| No anti-ban infra | `BrowserPool`/`SessionPool`/`ProxyProvider` (opt-in) |

## Residual risks (prioritized)
1. **Coverage scoped to critical paths**, not UI components/scrapers — acceptable; E2E logged-in flows still need a seeded test user (Phase 8 follow-up).
2. **Secrets shared in chat during setup** → rotate PAT, DB password, service-role, Groq, Resend, Upstash token.
3. **Proxy rotation is infra-only** — no proxy source wired (cost-free constraint); enable when a source exists.
4. **Ad↔product mapping is store-level** (`ads.product_id` usually null) — can over-credit ad backing.
5. **YouCan/Storeino extraction is theme-dependent** — custom themes need per-store tuning.
6. **No APM/alerting backend** — logs are structured but not shipped to a paging system (Phase 6/7 follow-up: self-host Grafana/Loki, free).

## Not yet started (by mandate order)
- **Phase 6 (Growth/Product):** referrals, onboarding, funnels, usage limits — intentionally deferred per instructions.
