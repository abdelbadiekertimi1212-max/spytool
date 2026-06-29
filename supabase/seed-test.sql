-- =============================================================================
-- E2E / test fixtures — deterministic, idempotent, isolated by the "E2E —"
-- naming marker and the fixed UUID block below. Safe to re-run.
--
-- NOTE: auth.users (the test accounts) are provisioned by scripts/reset-test-env.ts
-- via the Auth admin API (passwords can't be set from plain SQL). This file seeds
-- only the public catalog tables. reset-test-env.ts mirrors these upserts so CI
-- needs no psql; keep the two in sync.
-- =============================================================================

-- ---- Store ----------------------------------------------------------------
insert into public.stores (id, url, domain, name, platform, fb_page_name, country, lead_score, is_active, last_scraped_at, ads_checked_at)
values
  ('e2e00000-0000-4000-a000-000000000001', 'https://e2e-winner-store.test', 'e2e-winner-store.test', 'E2E — Winner Store', 'shopify', 'E2E Winner Store', 'DZ', 88, true, now(), now())
on conflict (url) do update set name = excluded.name, lead_score = excluded.lead_score, is_active = true;

-- ---- Products (one confirmed winner, one tracked) -------------------------
insert into public.products (id, store_id, external_id, title, niche, price, currency, image_url, current_stock, initial_stock, daily_velocity, is_winner, winner_since, first_seen_at)
values
  ('e2e00000-0000-4000-b000-000000000001', 'e2e00000-0000-4000-a000-000000000001', 'e2e-winner-1', 'E2E — Smart Watch DZ', 'Electronics & Gadgets', 4900, 'DZD', 'https://e2e-winner-store.test/img/watch.jpg', 60, 120, 12.5, true, now() - interval '2 days', now() - interval '5 days'),
  ('e2e00000-0000-4000-b000-000000000002', 'e2e00000-0000-4000-a000-000000000001', 'e2e-track-1', 'E2E — Kitchen Blender', 'Kitchen Gadgets', 3500, 'DZD', 'https://e2e-winner-store.test/img/blender.jpg', 90, 100, 0, false, null, now() - interval '1 day')
on conflict (store_id, external_id) do update set title = excluded.title, is_winner = excluded.is_winner, daily_velocity = excluded.daily_velocity, niche = excluded.niche;

-- ---- Snapshots (gradual depletion → velocity) ----------------------------
delete from public.product_snapshots where product_id = 'e2e00000-0000-4000-b000-000000000001';
insert into public.product_snapshots (product_id, stock, price, captured_at)
values
  ('e2e00000-0000-4000-b000-000000000001', 100, 4900, now() - interval '3 days'),
  ('e2e00000-0000-4000-b000-000000000001', 88,  4900, now() - interval '2 days'),
  ('e2e00000-0000-4000-b000-000000000001', 74,  4900, now() - interval '1 day'),
  ('e2e00000-0000-4000-b000-000000000001', 60,  4900, now());

-- ---- Ads (active, ad-backing for the winner) -----------------------------
insert into public.ads (id, store_id, meta_ad_id, ad_creative_url, creative_type, ad_copy, platform, start_date, is_active)
values
  ('e2e00000-0000-4000-c000-000000000001', 'e2e00000-0000-4000-a000-000000000001', 'e2e-ad-1', 'https://e2e-winner-store.test/img/watch.jpg', 'image', '🔥 الدفع عند الاستلام - ساعة ذكية', 'facebook', (now() - interval '6 days')::date, true),
  ('e2e00000-0000-4000-c000-000000000002', 'e2e00000-0000-4000-a000-000000000001', 'e2e-ad-2', 'https://e2e-winner-store.test/img/watch2.jpg', 'image', '✨ عرض خاص - توصيل لكل الولايات', 'facebook', (now() - interval '5 days')::date, true)
on conflict (meta_ad_id) do update set is_active = true, ad_copy = excluded.ad_copy;
