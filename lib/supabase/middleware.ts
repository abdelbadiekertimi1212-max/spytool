import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/supabase";

/**
 * Refreshes the Supabase auth session on every request and merges the updated
 * auth cookies onto the response produced by the next-intl middleware.
 *
 * The `handler` is the next-intl middleware: it runs first so locale
 * detection / redirects happen, then we attach Supabase's refreshed cookies to
 * whatever response it returned. This keeps i18n routing and auth in sync in a
 * single middleware pass.
 */
export async function updateSession(
  request: NextRequest,
  handler: (request: NextRequest) => NextResponse | Promise<NextResponse>
): Promise<NextResponse> {
  const response = await handler(request);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between client creation and getUser(). Touching
  // the user here triggers a token refresh and rewrites the session cookie.
  await supabase.auth.getUser();

  return response;
}
