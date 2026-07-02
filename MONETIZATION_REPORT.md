# Monetization Report — Phase 6.3

**Date:** 30 Jun 2026 · **Principle:** increase conversion **without dark patterns, fake urgency, forced upgrades, or paywall expansion.**

## Surfaces shipped
| Surface | Route | Purpose |
|---|---|---|
| Usage dashboard | `/dashboard/usage` | Transparency — daily usage vs. plan, remaining, state (healthy/near/grace/reached), progress bars |
| Billing center | `/dashboard/billing` | Current plan + status + renewal date, usage panel, plan matrix, upgrade + cancel/resume |
| Plan comparison | (billing) | starter / pro / agency features · limits · price · Pro recommendation |
| Revenue (internal) | `/dashboard/internal/revenue` | MRR / ARR / ARPU / paying / conversion% — `INTERNAL_EMAILS` gated |

## Plans (from `limit_rules`, Phase 6.2)
| Resource | starter | pro | agency |
|---|---|---|---|
| Winners/day | 10 | 200 | ∞ |
| Bookmarks/day | 10 | 100 | ∞ |
| Outreach/day | 1 | 20 | ∞ |

Prices (DZD/mo): starter 1,500 · pro 3,500 · agency 9,000 (unchanged; experiments never touch prices).

## Trust guarantees (verified)
- **No forced upgrades / no lockouts** — soft→grace→hard with a clear 429 + upgrade path; free/trial unlimited.
- **No fake ROI** — value shown = real counts (usage, remaining). No invented savings numbers.
- **No paywall expansion** — the Phase-2 catalog paywall is unchanged; 6.3 adds visibility + management only.
- **Existing payment logic preserved** — cancel/resume is a soft `cancel_at_period_end` toggle; Chargily checkout/webhook untouched.

## Pricing experiment (`PRICING_EXPERIMENT`)
Sticky A/B/Control by user bucket. Varies card **order** (Control default, A = Pro-first, B = reversed) and copy only. Default: Control (off).

## Levers for the operator
- Enable experiment: `PRICING_EXPERIMENT=true`.
- Read conversion in `analytics_events`: funnel `pricing_open → checkout_open → checkout_complete → upgrade_success`.
- Watch `limit_hit`/`limit_warning` → upgrade correlation as the limits rollout grows.
