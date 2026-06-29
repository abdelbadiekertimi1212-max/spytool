# Risk Report

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
