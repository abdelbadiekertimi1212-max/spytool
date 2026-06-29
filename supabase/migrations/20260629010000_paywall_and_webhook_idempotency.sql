-- =============================================================================
-- Phase 2 (critical fixes):
--   1. Re-enable the subscription PAYWALL at the database level. Catalog reads
--      now require an active/trialing subscription (was opened to all
--      authenticated users during the hardening pass). RLS is the source of
--      truth; the UI upsell gate is defense-in-depth on top.
--   2. Webhook IDEMPOTENCY / replay protection for Chargily events.
-- Idempotent — safe to re-run.
-- =============================================================================

-- ---- 1. Paywall: catalog SELECT requires private.has_active_subscription() ----
drop policy if exists "stores_read" on public.stores;
create policy "stores_read" on public.stores
  for select to authenticated using (private.has_active_subscription());

drop policy if exists "products_read" on public.products;
create policy "products_read" on public.products
  for select to authenticated using (private.has_active_subscription());

drop policy if exists "snapshots_read" on public.product_snapshots;
create policy "snapshots_read" on public.product_snapshots
  for select to authenticated using (private.has_active_subscription());

drop policy if exists "ads_read" on public.ads;
create policy "ads_read" on public.ads
  for select to authenticated using (private.has_active_subscription());

-- ---- 2. Webhook idempotency (Chargily replay protection) ----
create table if not exists public.processed_webhook_events (
  event_id    text primary key,
  provider    text not null default 'chargily',
  event_type  text,
  created_at  timestamptz not null default now()
);
alter table public.processed_webhook_events enable row level security;
-- No client policies → only the service_role (webhook) can read/write it.

-- =============================================================================
-- End migration
-- =============================================================================
