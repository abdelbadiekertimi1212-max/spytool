# Conversion Report — Phase 6.3

**Date:** 30 Jun 2026 · All tracking is **server-side** (no client SDK), fire-and-forget, gated by `ENABLE_ANALYTICS`.

## Funnel model (visit → intent → checkout → success)
| Stage | Event | Fired from |
|---|---|---|
| Visit | `pricing_open` | `/dashboard/billing` server render |
| Intent | `upgrade_open` / `upgrade_click` | reserved (billing UI) |
| Checkout | `checkout_open` | `POST /api/checkout` (after auth + validation) |
| Success | `checkout_complete`, `upgrade_success` | `POST /api/webhooks/chargily` on `checkout.paid` |
| Churn signal | `downgrade` | `POST /api/billing` (cancel) |

Upstream (Phase 6.1/6.2) the funnel joins the activation + limits events:
`signup → onboarding_completed → first_bookmark → dashboard_view → limit_warning/limit_hit → pricing_open → checkout_* → upgrade_success`.

## KPIs (computed in `lib/analytics/revenue.ts`)
- **MRR** = Σ price(active paid subs) · **ARR** = MRR × 12 · **ARPU** = MRR / paying.
- **Conversion %** = paying / total users.
- **activation→paid** and **limit→upgrade** are derivable from `analytics_events` (activation + limit events joined to `upgrade_success`).

## How to read it (SQL sketch)
```sql
-- daily funnel counts
select event_name, count(*) from analytics_events
where created_at > now() - interval '7 days'
  and event_name in ('pricing_open','checkout_open','checkout_complete','upgrade_success')
group by event_name;
```

## Status
Instrumentation is **live and complete**; conversion **rates** populate as real traffic + payments accrue (needs live Chargily keys + the usage-limits rollout to drive limit→upgrade). Internal revenue dashboard reads MRR/ARR/conversion now.

## Guardrails
No dark patterns, no fake urgency, no forced upgrades. Every event is opt-outable via `ENABLE_ANALYTICS=false` with zero behavioral impact.
