# Incident Response Runbook

## Severity
- **SEV1** — app down / payments broken / data loss. Respond immediately.
- **SEV2** — a major feature degraded (engine not running, dashboard empty for subscribers).
- **SEV3** — partial/cosmetic (one platform's scraper failing, niche tagging behind).

## First 5 minutes
1. `GET /api/health` — is `supabase` `ok`? Is it `degraded`?
2. Open `/dashboard/health` — error count (24h), last scrape time, recent `engine_logs`.
3. Check Vercel deployment status + the latest **CI** and **Winner Engine** Action runs.

## Common incidents

### App returns 500s after a deploy
- Vercel → promote the previous green deployment (rollback). Then reproduce locally with `npm run build`.

### Dashboard empty for a paying user
- Likely the **paywall** (RLS): confirm their `subscriptions.status` is `active`/`trialing` and `current_period_end` is in the future. RLS `private.has_active_subscription()` gates catalog reads by design.

### Payments not upgrading tiers
- Check `/api/webhooks/chargily` logs. Verify the Chargily webhook URL + signing. Replays are deduped via `processed_webhook_events` (idempotency) — a "duplicate" ack is expected and safe.

### Engine run failed (email/Action red)
- Open the Action logs. `npm ci` failures usually = Node major mismatch (keep CI on Node 24 / npm 11). Per-store scrape failures are isolated and logged to `engine_logs`; the run continues.

### Scraper getting blocked / CAPTCHAs
- `detectCaptcha()` hits rising in logs → reduce frequency (cron already 6h), and enable Phase 4 proxy rotation (`ENABLE_PROXY=true` + `PROXY_URLS`). Never lower the cron interval below 6h.

### Supabase unreachable from local CLI
- DNS to `db.<ref>.supabase.co` (IPv6-only) fails on IPv4 → use the **session pooler** URL (see OPERATIONS.md).

### AI classification failing / slow
- Groq calls retry with backoff + 20s timeout. Check `[classify]`/`[outreach]` token+latency logs. If Groq is down, classification degrades to `Uncategorized` (non-fatal); outreach surfaces a clean error to the user.

## Postmortem template
- **Impact:** who/what, duration. **Timeline:** detection → mitigation → resolution.
- **Root cause.** **Fix.** **Action items** (owner + date). Blameless.
