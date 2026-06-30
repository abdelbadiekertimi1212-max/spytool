-- =============================================================================
-- Phase D: Growth foundations (schema + events + limits ONLY — no UI, no
-- product behavior). Additive + idempotent. Does not touch subscriptions,
-- billing, existing RLS, or any API contract.
--
-- RLS posture:
--   analytics_events, crm_enrichment → service-role only (no client policies),
--     written by server-side collectors (no client SDK).
--   usage_counters, referrals        → owner-readable; writes via service-role / RPC.
--   limit_rules                       → readable by any authenticated user (plan config).
-- =============================================================================

-- ---- analytics_events (partition-ready: time-ordered, created_at indexed) ----
create table if not exists public.analytics_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles (id) on delete set null,
  anonymous_id  text,
  event_name    text not null,
  properties    jsonb not null default '{}'::jsonb,
  session_id    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_analytics_events_user on public.analytics_events (user_id);
create index if not exists idx_analytics_events_name on public.analytics_events (event_name);
create index if not exists idx_analytics_events_time on public.analytics_events (created_at desc);
alter table public.analytics_events enable row level security;
-- No client policies → service-role collectors only.

-- ---- usage_counters (daily | monthly | lifetime windows) -------------------
create table if not exists public.usage_counters (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  metric    text not null,
  "window"  text not null check ("window" in ('daily', 'monthly', 'lifetime')),
  value     integer not null default 0,
  reset_at  timestamptz,
  primary key (user_id, metric, "window")
);
alter table public.usage_counters enable row level security;
grant select on public.usage_counters to authenticated;
create policy "usage_counters_select_own" on public.usage_counters
  for select to authenticated using (user_id = (select auth.uid()));

-- ---- referrals (no self-referral, no duplicate referred user, unique code) --
create table if not exists public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_user_id   uuid not null references public.profiles (id) on delete cascade,
  referred_user_id   uuid references public.profiles (id) on delete set null,
  code               text not null unique,
  status             text not null default 'pending', -- pending | converted | expired
  reward_state       text not null default 'none',    -- none | granted | revoked
  created_at         timestamptz not null default now(),
  constraint referrals_no_self check (referrer_user_id <> referred_user_id),
  constraint referrals_unique_referred unique (referred_user_id)
);
create index if not exists idx_referrals_referrer on public.referrals (referrer_user_id);
alter table public.referrals enable row level security;
grant select on public.referrals to authenticated;
create policy "referrals_select_own" on public.referrals
  for select to authenticated
  using (referrer_user_id = (select auth.uid()) or referred_user_id = (select auth.uid()));

-- ---- crm_enrichment (internal scoring; service-role only) ------------------
create table if not exists public.crm_enrichment (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  source      text,
  score       integer not null default 0,
  stage       text not null default 'new',
  metadata    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.crm_enrichment enable row level security;
-- No client policies → service-role only.

-- ---- limit_rules (plan × resource soft/hard limits) ------------------------
create table if not exists public.limit_rules (
  plan        text not null check (plan in ('starter', 'pro', 'agency')),
  resource    text not null,
  soft_limit  integer not null,
  hard_limit  integer not null,
  enabled     boolean not null default true,
  primary key (plan, resource)
);
alter table public.limit_rules enable row level security;
grant select on public.limit_rules to authenticated;
create policy "limit_rules_read" on public.limit_rules
  for select to authenticated using (true);

insert into public.limit_rules (plan, resource, soft_limit, hard_limit, enabled) values
  ('starter', 'outreach_per_day', 20, 30, true),
  ('pro', 'outreach_per_day', 100, 150, true),
  ('agency', 'outreach_per_day', 400, 600, true),
  ('starter', 'ai_classify_per_day', 50, 100, true),
  ('pro', 'ai_classify_per_day', 300, 500, true),
  ('agency', 'ai_classify_per_day', 2000, 3000, true),
  ('starter', 'tracked_stores', 50, 75, true),
  ('pro', 'tracked_stores', 100000, 100000, false),
  ('agency', 'tracked_stores', 100000, 100000, false)
on conflict (plan, resource) do nothing;

-- ---- Atomic, race-safe usage increment (service-role only) -----------------
create or replace function public.increment_usage(
  p_user_id uuid,
  p_metric text,
  p_window text,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reset timestamptz;
  v_value integer;
begin
  v_reset := case p_window
    when 'daily' then date_trunc('day', now()) + interval '1 day'
    when 'monthly' then date_trunc('month', now()) + interval '1 month'
    else 'infinity'::timestamptz
  end;

  insert into public.usage_counters (user_id, metric, "window", value, reset_at)
  values (p_user_id, p_metric, p_window, p_amount, v_reset)
  on conflict (user_id, metric, "window") do update
    set value = case
                  when public.usage_counters.reset_at is not null
                       and public.usage_counters.reset_at <= now()
                  then p_amount
                  else public.usage_counters.value + p_amount
                end,
        reset_at = case
                     when public.usage_counters.reset_at is not null
                          and public.usage_counters.reset_at <= now()
                     then excluded.reset_at
                     else public.usage_counters.reset_at
                   end
  returning value into v_value;

  return v_value;
end;
$$;

revoke all on function public.increment_usage(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, text, text, integer) to service_role;
