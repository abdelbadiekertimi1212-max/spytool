-- =============================================================================
-- Phase 6.1: Activation / first-run onboarding state on profiles.
-- Additive + idempotent. Owner can read/update via the EXISTING profiles RLS
-- policies (no policy change). No behavior change until the UI reads these.
-- =============================================================================

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists preferred_categories text[] not null default '{}',
  add column if not exists experience_level text,
  add column if not exists country text;
