-- =============================================================================
-- Phase B: Image rehosting.
--   * products.image_rehosted_url — the cached Storage URL (preferred at serve
--     time; original image_url is preserved as fallback → no rendering breaks).
--   * media_assets — dedupe ledger (one row per unique content hash).
--   * product-images — public Storage bucket for the rehosted webp variants.
-- Additive + idempotent. No data migration; rehosting runs via the worker.
-- =============================================================================

alter table public.products
  add column if not exists image_rehosted_url text;

create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products (id) on delete cascade,
  source_url    text,
  storage_path  text,
  content_hash  text not null,
  mime          text,
  width         integer,
  height        integer,
  size_bytes    integer,
  status        text not null default 'ready', -- ready | failed
  created_at    timestamptz not null default now()
);

create index if not exists idx_media_assets_product on public.media_assets (product_id);
create unique index if not exists idx_media_assets_hash on public.media_assets (content_hash);

alter table public.media_assets enable row level security;
-- No client policies → only the service_role (worker) reads/writes media_assets.

-- Public bucket for rehosted images (public read via getPublicUrl; writes are
-- service-role and bypass RLS).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
