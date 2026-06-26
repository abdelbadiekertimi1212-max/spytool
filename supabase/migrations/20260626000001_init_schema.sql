-- =============================================================================
-- Migration: 20260626000001_init_schema.sql
-- Project:   WinnerRadar — COD Winning-Product Intelligence SaaS (Algeria)
-- Phase 1:   Extensions, enums, private helpers, core tables, triggers,
--            indexes, grants, and STRICT Row Level Security.
--
-- Access model
--   * profiles / subscriptions ..... per-user (owner-only).
--   * stores / products / ads ...... global scraped catalog, read-only to any
--                                    user holding an active/trialing
--                                    subscription. Writes happen exclusively
--                                    through the service_role (scraper/cron),
--                                    which bypasses RLS.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 0. Extensions & private (non-exposed) schema
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";     -- fuzzy search on titles / urls

-- The `private` schema is NOT in PostgREST's exposed-schemas list, so nothing
-- here is reachable through the Data API. SECURITY DEFINER helpers live here so
-- they can never be invoked directly by the anon / authenticated roles.
create schema if not exists private;
revoke all on schema private from anon, authenticated;
-- authenticated needs USAGE so RLS policies can resolve the helper below.
grant usage on schema private to authenticated;


-- ----------------------------------------------------------------------------
-- 1. Enumerated types
-- ----------------------------------------------------------------------------
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'expired'
);

create type public.package_tier as enum (
  'free', 'starter', 'pro', 'agency'
);

create type public.store_platform as enum (
  'shopify', 'youcan', 'storeino'
);

create type public.ad_platform as enum (
  'facebook', 'instagram', 'audience_network', 'messenger'
);

create type public.ad_creative_type as enum (
  'image', 'video', 'carousel', 'dco'
);


-- ----------------------------------------------------------------------------
-- 2. Shared trigger helper: keep updated_at fresh
-- ----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3. profiles  (1:1 mirror of auth.users, holds profile data)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  locale      text not null default 'ar' check (locale in ('ar', 'fr', 'en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Public profile mirror of auth.users.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();


-- ----------------------------------------------------------------------------
-- 4. subscriptions  (one active subscription per user)
-- ----------------------------------------------------------------------------
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique
                              references public.profiles (id) on delete cascade,
  status                    public.subscription_status not null default 'trialing',
  package_tier              public.package_tier not null default 'free',
  chargily_customer_id      text,
  chargily_subscription_id  text,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
comment on table public.subscriptions is 'Billing tier & status, mutated only by the Chargily webhook (service_role).';

create index idx_subscriptions_user_id on public.subscriptions (user_id);

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();


-- ----------------------------------------------------------------------------
-- 5. stores  (discovered Algerian storefronts + B2B lead enrichment)
-- ----------------------------------------------------------------------------
create table public.stores (
  id               uuid primary key default gen_random_uuid(),
  url              text not null unique,
  domain           text,
  name             text,
  platform         public.store_platform not null,
  fb_page_id       text,
  fb_page_name     text,
  fb_page_url      text,
  country          text not null default 'DZ',
  -- B2B CRM enrichment (Phase 4 Groq output)
  lead_score       integer not null default 0 check (lead_score between 0 and 100),
  ai_call_hook     text,
  ai_email_hook    text,
  contact_email    text,
  contact_phone    text,
  -- pipeline bookkeeping
  is_active        boolean not null default true,
  last_scraped_at  timestamptz,
  ads_checked_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.stores is 'Global catalog of tracked storefronts; written by the scraper (service_role).';

create index idx_stores_platform   on public.stores (platform);
create index idx_stores_lead_score on public.stores (lead_score desc);
create index idx_stores_fb_page_id on public.stores (fb_page_id);
create index idx_stores_url_trgm   on public.stores using gin (url gin_trgm_ops);

create trigger trg_stores_updated_at
  before update on public.stores
  for each row execute function private.set_updated_at();


-- ----------------------------------------------------------------------------
-- 6. products  (per-store inventory + winner metrics)
-- ----------------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores (id) on delete cascade,
  external_id       text,                       -- platform product / variant id
  handle            text,
  title             text not null,
  description       text,
  price             numeric(12, 2),
  compare_at_price  numeric(12, 2),
  currency          text not null default 'DZD',
  image_url         text,
  product_url       text,
  -- inventory + velocity
  current_stock     integer,
  initial_stock     integer,
  total_sold        integer not null default 0,
  daily_velocity    numeric(10, 2) not null default 0,   -- units sold / day
  is_winner         boolean not null default false,
  winner_since      timestamptz,
  first_seen_at     timestamptz not null default now(),
  last_checked_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (store_id, external_id)
);
comment on table public.products is 'Tracked products; is_winner toggled by the velocity+ad cron (service_role).';

create index idx_products_store_id    on public.products (store_id);
create index idx_products_is_winner   on public.products (is_winner) where is_winner;
create index idx_products_velocity    on public.products (daily_velocity desc);
create index idx_products_title_trgm  on public.products using gin (title gin_trgm_ops);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();


-- ----------------------------------------------------------------------------
-- 7. product_snapshots  (time-series feeding the velocity formula)
--    daily_velocity = (Stock_T0 - Stock_T1) / Δt  is computed across these rows
-- ----------------------------------------------------------------------------
create table public.product_snapshots (
  id           bigint generated always as identity primary key,
  product_id   uuid not null references public.products (id) on delete cascade,
  stock        integer,
  price        numeric(12, 2),
  captured_at  timestamptz not null default now()
);
comment on table public.product_snapshots is 'Append-only stock readings used to derive daily_velocity.';

create index idx_snapshots_product_time
  on public.product_snapshots (product_id, captured_at desc);


-- ----------------------------------------------------------------------------
-- 8. ads  (active Meta Ad Library creatives per store / product)
-- ----------------------------------------------------------------------------
create table public.ads (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores (id) on delete cascade,
  product_id       uuid references public.products (id) on delete set null,
  meta_ad_id       text unique,                 -- Ad Library ad_archive_id
  ad_creative_url  text,
  creative_type    public.ad_creative_type not null default 'image',
  ad_copy          text,
  cta_text         text,
  landing_url      text,
  platform         public.ad_platform not null default 'facebook',
  impressions_min  bigint,
  impressions_max  bigint,
  start_date       date,
  end_date         date,
  is_active        boolean not null default true,
  raw              jsonb,                        -- full Graph API payload
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.ads is 'Active Meta ad creatives verifying ad-backing for the winner algorithm.';

create index idx_ads_store_id   on public.ads (store_id);
create index idx_ads_product_id on public.ads (product_id);
create index idx_ads_active     on public.ads (is_active) where is_active;
create index idx_ads_start_date on public.ads (start_date desc);

create trigger trg_ads_updated_at
  before update on public.ads
  for each row execute function private.set_updated_at();


-- ----------------------------------------------------------------------------
-- 9. Auth bootstrap: auto-provision profile + free subscription on signup
-- ----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, locale)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'locale', 'ar')
  );

  insert into public.subscriptions (user_id, status, package_tier, current_period_end)
  values (new.id, 'trialing', 'free', now() + interval '7 days');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();


-- ----------------------------------------------------------------------------
-- 10. Authorization helper: does the current user have catalog access?
--     SECURITY DEFINER so it can read subscriptions regardless of caller RLS.
-- ----------------------------------------------------------------------------
create or replace function private.has_active_subscription()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status in ('trialing', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

revoke all on function private.has_active_subscription() from public;
grant execute on function private.has_active_subscription() to authenticated;


-- ----------------------------------------------------------------------------
-- 11. Table privileges (RLS still gates every row on top of these)
-- ----------------------------------------------------------------------------
grant select, update on public.profiles          to authenticated;
grant select          on public.subscriptions     to authenticated;
grant select          on public.stores            to authenticated;
grant select          on public.products          to authenticated;
grant select          on public.product_snapshots to authenticated;
grant select          on public.ads               to authenticated;


-- ----------------------------------------------------------------------------
-- 12. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.stores            enable row level security;
alter table public.products          enable row level security;
alter table public.product_snapshots enable row level security;
alter table public.ads               enable row level security;

-- ---- profiles: owner-only read/update --------------------------------------
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---- subscriptions: owner-only read (mutations via service_role webhook) ----
create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- ---- catalog: read-only for active subscribers ------------------------------
create policy "stores_select_subscribers"
  on public.stores for select to authenticated
  using (private.has_active_subscription());

create policy "products_select_subscribers"
  on public.products for select to authenticated
  using (private.has_active_subscription());

create policy "snapshots_select_subscribers"
  on public.product_snapshots for select to authenticated
  using (private.has_active_subscription());

create policy "ads_select_subscribers"
  on public.ads for select to authenticated
  using (private.has_active_subscription());

-- NOTE: No INSERT / UPDATE / DELETE policies exist for stores, products,
-- product_snapshots, or ads. With RLS enabled and no permissive write policy,
-- all writes are denied to anon/authenticated. The scraper & cron jobs connect
-- with the service_role key, which bypasses RLS entirely. This is intentional.

-- =============================================================================
-- End migration
-- =============================================================================
