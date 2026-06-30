# Data Flow — Phase D Foundations

## Event tracking (server-side only, no client SDK)
```
server route / worker
   └─ trackServer({ event_name, user_id?, properties })   [lib/events/collector.ts]
        ├─ analyticsEnabled()?  (ENABLE_ANALYTICS, default true) ── no ──▶ drop
        ├─ validateEvent()       [schemas.ts]  ── invalid ──▶ drop
        ├─ eventBuffer.add()     [batch.ts]    (in-memory, per-process)
        └─ flush() → flushEvents(adminClient, drained)  [flush.ts]
                       └─ INSERT public.analytics_events   (service-role; RLS bypass)
```
- Fire-and-forget: the collector voids its promise and swallows all errors, so it **cannot change a response or break a request** (contract-preserving).
- Wired once so far: Chargily webhook `checkout.paid` → `subscription_change`. All other events are ready to attach in Phase 6.

## Usage limits (enforcement OFF by default)
```
check:   checkLimit(client, userId, plan, resource, window)   [limits/check.ts]
            ├─ usageLimitsEnabled()? (ENABLE_USAGE_LIMITS, default false) ── no ──▶ allow-all
            ├─ read limit_rules (plan,resource) + usage_counters (expired window ⇒ 0)
            └─ decide(value, rule)  [policy.ts]  → { allowed, value, soft, hard, nearSoft }

increment: incrementUsage(adminClient, userId, metric, window, amount)  [limits/increment.ts]
            └─ rpc increment_usage(...)  → atomic upsert (race-safe, lazy reset)

reset:    resetExpired(client) / resetUsage(client, userId, metric?)  [limits/reset.ts]
```

## Flags
| Flag | Default | Gates |
|---|---|---|
| `ENABLE_ANALYTICS` | `true` | event collection |
| `ENABLE_USAGE_LIMITS` | `false` | limit enforcement (checks allow-all when off) |
| `ENABLE_REFERRALS` | `false` | referral logic (schema only for now) |
| `ENABLE_CRM` | `false` | CRM enrichment writes (schema only for now) |

## Independence
Analytics/limits read & write their own tables only. They never read or mutate `subscriptions`, `billing`, `products`, or any catalog table — so they cannot affect the winner engine, payments, or existing API contracts.
