import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * Use ONLY in trusted server contexts — the Crawlee scraper, cron jobs, and the
 * Chargily webhook — where catalog tables must be written. Never import this
 * into a Client Component; the `server-only` guard will fail the build if you do.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The admin client cannot start."
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
