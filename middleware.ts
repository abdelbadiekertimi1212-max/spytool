import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // next-intl handles locale routing; updateSession refreshes the Supabase
  // auth session and merges its cookies onto the i18n response.
  return updateSession(request, intlMiddleware);
}

export const config = {
  // Run on all paths except Next internals, API routes, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
