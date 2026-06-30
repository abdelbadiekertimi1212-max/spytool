# Limits Guide

The usage-limit engine is **off by default** (`ENABLE_USAGE_LIMITS=false`) — `checkLimit`
returns allow-all, so nothing changes until you flip the flag.

## Model
- **Rules** live in `limit_rules (plan, resource, soft_limit, hard_limit, enabled)`.
- **Usage** lives in `usage_counters (user_id, metric, window, value, reset_at)`, window ∈ `daily | monthly | lifetime`.
- A resource's `metric` name == its `resource` name (e.g. `outreach_per_day`).

## Seeded rules
| resource | starter | pro | agency |
|---|---|---|---|
| `outreach_per_day` | 20 / 30 | 100 / 150 | 400 / 600 |
| `ai_classify_per_day` | 50 / 100 | 300 / 500 | 2000 / 3000 |
| `tracked_stores` | 50 / 75 | unlimited* | unlimited* |
(*`enabled=false` → treated as no limit. Values shown as soft / hard.)

## Decision semantics (`decide`)
- No rule, or `enabled=false` → **allowed** (unlimited).
- `value < hard_limit` → **allowed**; `value >= soft_limit` also sets `nearSoft` (UI nudge).
- `value >= hard_limit` → **blocked**.

## Usage in Phase 6 (when enabling)
```ts
import { checkLimit } from "@/lib/limits/check";
import { incrementUsage } from "@/lib/limits/increment"; // service-role client

const decision = await checkLimit(supabase, userId, plan, "outreach_per_day");
if (!decision.allowed) return res(429);
// ...perform the action...
await incrementUsage(adminClient, userId, "outreach_per_day"); // atomic, lazy-resets the window
```

## Atomicity & race-safety
`increment_usage` is a `SECURITY DEFINER` SQL function doing a single `INSERT … ON CONFLICT DO UPDATE`
(one round trip, no read-modify-write race). It lazily resets the counter when `reset_at` has passed.
EXECUTE is granted to `service_role` only — never call it from a client.

## Rollout checklist
1. Set `ENABLE_USAGE_LIMITS=true` in the env.
2. Add `checkLimit` guards to the relevant routes (e.g. `/api/outreach`).
3. Call `incrementUsage` **after** the action succeeds.
4. Optionally schedule `resetExpired` daily (lazy reset already covers correctness).
