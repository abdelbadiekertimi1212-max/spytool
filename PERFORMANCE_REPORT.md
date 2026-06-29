# Performance Report

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

## Remaining optimization opportunities
- **Re-host scraped images** to Supabase Storage via `sharp` → enables Next/Image optimization (currently `unoptimized` + wildcard remote host).
- **Cache dashboard analytics** (short TTL) — `getDashboardAnalytics` runs several aggregates per request; a 60s cache or a materialized view would cut DB load at scale.
- **Server-side product search** (`tsvector` + `pg_trgm`) once the feed exceeds a few hundred client-side rows.
- **Queue the engine** (`pg-boss` on existing Postgres) for retries/backpressure as store count grows.
