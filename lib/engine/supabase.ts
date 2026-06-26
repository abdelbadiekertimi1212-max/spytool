import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";

/**
 * Service-role Supabase client for the standalone engine scripts (run via tsx /
 * GitHub Actions, NOT inside Next.js). It BYPASSES RLS and must only ever run in
 * a trusted server/CI context. Deliberately does not import `server-only` (that
 * guard throws outside the Next bundler).
 */
export function createEngineClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Engine Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-engine": "winnerradar-scraper" } },
  });
}
