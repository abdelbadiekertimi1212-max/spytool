-- =============================================================================
-- Phase 3 (performance): bulk winner-metrics update.
-- Replaces N per-product UPDATE round-trips in computeWinners() with ONE call
-- that applies a whole batch via a single set-based UPDATE FROM jsonb.
-- SECURITY INVOKER: only the service_role (which bypasses RLS) may execute it.
-- =============================================================================

create or replace function public.apply_winner_metrics(updates jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  update public.products p set
    daily_velocity = (u.elem ->> 'daily_velocity')::numeric,
    total_sold     = (u.elem ->> 'total_sold')::integer,
    is_winner      = (u.elem ->> 'is_winner')::boolean,
    winner_since   = nullif(u.elem ->> 'winner_since', '')::timestamptz
  from (select jsonb_array_elements(updates) as elem) u
  where p.id = (u.elem ->> 'id')::uuid;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Lock it down: not callable by browser clients, only the trusted engine.
revoke all on function public.apply_winner_metrics(jsonb) from public, anon, authenticated;
