-- =============================================================================
-- Phase 5: AI niche auto-tagging.
-- Adds a `niche` column to products (set by the Groq/Llama-3 classifier) and an
-- index for the dashboard niche filter.
-- =============================================================================

alter table public.products
  add column if not exists niche text;

create index if not exists idx_products_niche on public.products (niche);
