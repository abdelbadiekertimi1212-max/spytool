-- =============================================================================
-- Phase 6.2: align limit_rules to the monetization spec.
--   soft_limit = the stated daily allowance (warn / grace starts here)
--   hard_limit = soft + grace band (block here — soft→grace→hard, no lockout)
--   agency     = enabled=false → unlimited
-- Idempotent upsert. Free/trial users have NO rule → unlimited (protects activation).
-- =============================================================================

insert into public.limit_rules (plan, resource, soft_limit, hard_limit, enabled) values
  ('starter', 'winners_per_day', 10, 12, true),
  ('pro', 'winners_per_day', 200, 240, true),
  ('agency', 'winners_per_day', 100000, 100000, false),

  ('starter', 'bookmarks_per_day', 10, 12, true),
  ('pro', 'bookmarks_per_day', 100, 120, true),
  ('agency', 'bookmarks_per_day', 100000, 100000, false),

  ('starter', 'outreach_per_day', 1, 2, true),
  ('pro', 'outreach_per_day', 20, 24, true),
  ('agency', 'outreach_per_day', 100000, 100000, false)
on conflict (plan, resource) do update
  set soft_limit = excluded.soft_limit,
      hard_limit = excluded.hard_limit,
      enabled = excluded.enabled;
