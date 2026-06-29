-- =============================================================================
-- Production hardening: high-volume indexes, strict RLS, personal-data table
-- (bookmarks), and an engine_logs table for silent-failure tracking.
-- Idempotent — safe to re-run.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. High-volume read indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_products_created_at  on public.products (created_at desc);
create index if not exists idx_products_first_seen  on public.products (first_seen_at desc);
-- Composite for the dashboard feed ordering (winners first, then velocity).
create index if not exists idx_products_feed        on public.products (is_winner, daily_velocity desc);
create index if not exists idx_products_niche        on public.products (niche);
create index if not exists idx_stores_created_at     on public.stores (created_at desc);
create index if not exists idx_ads_store_active      on public.ads (store_id, is_active);

-- ----------------------------------------------------------------------------
-- 2. Personal-data table: bookmarks (owner read/write)
-- ----------------------------------------------------------------------------
create table if not exists public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists idx_bookmarks_user on public.bookmarks (user_id);

-- ----------------------------------------------------------------------------
-- 3. engine_logs: structured failure log (service-role only; no client access)
-- ----------------------------------------------------------------------------
create table if not exists public.engine_logs (
  id          bigint generated always as identity primary key,
  level       text not null default 'info',
  scope       text not null,
  message     text not null,
  context     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_engine_logs_created on public.engine_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Enable RLS on every core table
-- ----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.stores            enable row level security;
alter table public.products          enable row level security;
alter table public.product_snapshots enable row level security;
alter table public.ads               enable row level security;
alter table public.bookmarks         enable row level security;
alter table public.engine_logs       enable row level security;

-- ----------------------------------------------------------------------------
-- 5. Table privileges (RLS still gates rows on top of these grants)
-- ----------------------------------------------------------------------------
grant select, update on public.profiles            to authenticated;
grant select          on public.subscriptions       to authenticated;
grant select          on public.stores              to authenticated;
grant select          on public.products            to authenticated;
grant select          on public.product_snapshots   to authenticated;
grant select          on public.ads                 to authenticated;
grant select, insert, delete on public.bookmarks    to authenticated;
-- engine_logs: intentionally NO grant to authenticated (service_role only).

-- ----------------------------------------------------------------------------
-- 6. Policies — (a) global READ-only, (b) owner personal data, (c) writes = service_role
-- ----------------------------------------------------------------------------

-- (b) profiles: owner read/update only.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- (b) subscriptions: owner read only (writes via Chargily webhook = service_role).
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- (a) global catalog: any authenticated user may READ; NO write policy exists,
--     so inserts/updates/deletes are denied to clients and only the service_role
--     (cron/engine, which bypasses RLS) can write.
drop policy if exists "stores_select_subscribers" on public.stores;
drop policy if exists "stores_read" on public.stores;
create policy "stores_read" on public.stores for select to authenticated using (true);

drop policy if exists "products_select_subscribers" on public.products;
drop policy if exists "products_read" on public.products;
create policy "products_read" on public.products for select to authenticated using (true);

drop policy if exists "snapshots_select_subscribers" on public.product_snapshots;
drop policy if exists "snapshots_read" on public.product_snapshots;
create policy "snapshots_read" on public.product_snapshots for select to authenticated using (true);

drop policy if exists "ads_select_subscribers" on public.ads;
drop policy if exists "ads_read" on public.ads;
create policy "ads_read" on public.ads for select to authenticated using (true);

-- (b) bookmarks: owner read/insert/delete.
drop policy if exists "bookmarks_select_own" on public.bookmarks;
create policy "bookmarks_select_own" on public.bookmarks
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "bookmarks_insert_own" on public.bookmarks;
create policy "bookmarks_insert_own" on public.bookmarks
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "bookmarks_delete_own" on public.bookmarks;
create policy "bookmarks_delete_own" on public.bookmarks
  for delete to authenticated using (user_id = (select auth.uid()));

-- (c) engine_logs: no policies for authenticated/anon → all client access denied.
--     Only the service_role (RLS bypass) reads/writes it.

-- =============================================================================
-- End hardening migration
-- =============================================================================
