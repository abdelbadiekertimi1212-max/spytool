# Performance Report

**Date:** 30 Jun 2026 (Phase 6.1)

## Phase 6.2 — Usage Limits
- **Zero overhead when disabled** (default): the whole limit block is gated behind `inRollout()` — a pure in-process FNV hash, no DB call — so unenrolled/disabled requests are untouched.
- When enrolled: one indexed `limit_rules` read + one `usage_counters` read on check, and a single atomic `increment_usage` RPC after success (no read-modify-write race). Usage headers add negligible cost.
- `limit_warning`/`limit_hit` are fire-and-forget events (no added response latency).

## Phase 6.1 — Activation
- **No added cost to existing paths.** `getActivationStatus` (profile + bookmark count + subscription — all indexed, owner-RLS) is folded into the dashboard's existing parallel `Promise.all`; no new sequential round-trips.
- Bookmark toggles are **optimistic** (instant UI) with a single owner-RLS insert/delete; first-bookmark detection is one `head:true` count.
- Event collection is fire-and-forget (`void`) → `dashboard_view`/`onboarding_*` tracking adds zero latency to responses.
- Bundle: `/dashboard/onboarding` 3.3 kB; existing dashboard first-load JS unchanged.

---

**Date:** 29 Jun 2026

## Wins delivered
| Area | Before | After | How |
|---|---|---|---|
| `computeWinners` | ~9 min | **~21 s** | Single SQL RPC batch update + 100-id snapshot batches (replaced per-product N+1 queries) |
| Dashboard First-Load JS | 284 kB | **173 kB** | Lazy-loaded Recharts + loading skeleton |
| Snapshot reads in winner pass | N queries | **1 query / batch** | `.in(product_id, batchIds)` |
| AI calls | unbounded, could hang | **retry + 20s timeout** | `withRetry`/`withTimeout` |
| `/api/health` | — | fast HEAD-count probe | uptime monitoring |

## Targets vs status
- **API < 300 ms:** routes are thin (auth + zod + 1–2 indexed queries / external call). The Groq/Chargily-bound routes are dominated by provider latency (bounded by the 20s timeout), not our code.
- **Winner compute < 60 s:** ✅ ~21 s on the current dataset (2.5k products).
- **Page load < 1.5 s:** dashboard payload cut ~40%; dynamic pages are `force-dynamic` (server-rendered per request) — gated by Supabase query latency. Recharts is code-split.

## Indexing (high-volume read paths)
`products(is_winner partial, daily_velocity desc, niche, created_at, first_seen_at, (is_winner,daily_velocity), title trgm)`, `stores(platform, lead_score, created_at, url trgm)`, `ads(store_id, is_active, start_date)`, `product_snapshots(product_id, captured_at desc)`, `engine_logs(created_at desc)`.

## Phase B — Image rehosting (29 Jun 2026)
External image hosts were the main render risk (hotlink 403s, expired fbcdn media, large/untrusted payloads). The `lib/media` pipeline downloads → sanitizes (EXIF stripped) → resizes → converts to **webp q80 (≤1600px)** → dedupes by sha256 → uploads to Supabase Storage, serving rehosted → original → placeholder.

| Metric | Before (external) | After (rehosted webp) |
|---|---|---|
| Bytes, 3 sample product images | 2,649,745 B (2.65 MB) | **327,956 B (0.33 MB)** |
| **Bandwidth reduction** | — | **87.6%** |
| Avg image size | ~883 KB | **~109 KB** |
| Host trust | arbitrary external CDNs | first-party Supabase Storage |
| Hotlink/expiry failures | possible (fbcdn) | eliminated (cached copy) + safe fallback |
| Format | mixed jpg/png/… | uniform webp, 3 sizes (thumb/card/full) |

Dedupe: identical bytes across stores upload once (unique `content_hash`) → a widely-copied product image costs one object, not N. Worker is incremental + idempotent (`media:rehost`), gated by `ENABLE_IMAGE_REHOST`; serving always falls back so rendering never breaks.

## Phase C — Engine queue / durable execution (29 Jun 2026)
Reliability, not raw speed. The cron pipeline was all-or-nothing (one failed stage
aborted the run with no retry/visibility). pg-boss adds durability **without changing
business logic or the default path**.

| Dimension | Cron (before) | Queue (ENABLE_QUEUE=true) |
|---|---|---|
| Failure handling | stage aborts the whole run | per-job **retry + exp. backoff**, then **dead-letter** |
| Recovery | manual re-run of the whole pipeline | `queue:replay` (redrive failed), per-job `retry`/`cancel` |
| Concurrency | sequential | per-stage (`1/3/2/2/1`), config-driven |
| Resumability | restart from scratch | resume-safe chain (each stage enqueues the next) |
| Visibility | logs only | `queue_runs` + `/dashboard/health/jobs` (latency, failures, last run) |
| Flag off (default) | — | **byte-for-byte identical to cron** (no regression) |

Per-stage job duration + failure recovery are now measured in `queue_runs` (avg duration,
failures, running count surfaced on the jobs dashboard). No measurable overhead with the
flag off (the queue code isn't loaded by the cron scripts).

## Remaining optimization opportunities
- ✅ **Re-host scraped images** — done (Phase B, 87.6% smaller). Next: switch winner cards off `unoptimized` to Next/Image optimization now that images are first-party uniform webp, and tighten `remotePatterns` to the Storage host.
- **Cache dashboard analytics** (short TTL) — `getDashboardAnalytics` runs several aggregates per request; a 60s cache or a materialized view would cut DB load at scale.
- **Server-side product search** (`tsvector` + `pg_trgm`) once the feed exceeds a few hundred client-side rows.
- **Queue the engine** (`pg-boss` on existing Postgres) for retries/backpressure as store count grows.
