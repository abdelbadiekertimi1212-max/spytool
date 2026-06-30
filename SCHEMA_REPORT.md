# Schema Report — Phase D (Growth Foundations)

Migration: `supabase/migrations/20260629050000_growth_foundations.sql` (additive, idempotent).
All tables are dormant until their flag is enabled — **no UI, no behavior change**.

## Tables

### analytics_events  *(service-role only)*
| column | type | notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| user_id | uuid → profiles(id) ON DELETE SET NULL | nullable (anonymous events) |
| anonymous_id | text | pre-auth identifier |
| event_name | text NOT NULL | from the taxonomy |
| properties | jsonb | default `{}` |
| session_id | text | |
| created_at | timestamptz | default `now()` |
Indexes: `user_id`, `event_name`, `created_at DESC` (partition-ready by time). RLS on, **no client policies** → written only by server-side collectors.

### usage_counters  *(owner-readable)*
PK `(user_id, metric, window)`; `value int`, `reset_at timestamptz`. `window ∈ {daily, monthly, lifetime}`. RLS: owner `select`; writes via the `increment_usage` RPC (service-role).

### referrals  *(owner-readable)*
`id`, `referrer_user_id → profiles`, `referred_user_id → profiles (nullable)`, `code unique`, `status`, `reward_state`, `created_at`. Constraints: **no self-referral** (`referrer <> referred`), **no duplicate referred** (`unique(referred_user_id)`), unique `code`. RLS: select where caller is referrer or referred; writes service-role.

### crm_enrichment  *(service-role only)*
PK `user_id → profiles`; `source`, `score int`, `stage`, `metadata jsonb`, `updated_at`. **No external APIs.** RLS on, no client policies.

### limit_rules  *(authenticated-readable config)*
PK `(plan, resource)`; `soft_limit`, `hard_limit`, `enabled`. Seeded for `starter/pro/agency` across `outreach_per_day`, `ai_classify_per_day`, `tracked_stores`. RLS: authenticated `select`; writes service-role.

## Functions
`public.increment_usage(p_user_id, p_metric, p_window, p_amount=1) → int` — `SECURITY DEFINER`, atomic upsert with lazy window reset. EXECUTE **revoked** from anon/authenticated, **granted to service_role** only.

## Preserved (untouched)
`profiles`, `subscriptions`, `stores`, `products`, `ads`, `product_snapshots`, `bookmarks`, `media_assets`, `queue_runs`, `processed_webhook_events`, `engine_logs` — and all existing RLS / billing / API contracts.
