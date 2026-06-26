import { setRequestLocale } from "next-intl/server";
import { Radar } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Auth-gated: must read the live session per request, never prerender.
export const dynamic = "force-dynamic";

/**
 * Placeholder dashboard. The full Winner Product Radar + B2B CRM ships in
 * Phase 3. For now this proves the server-side Supabase auth wiring compiles
 * and runs: it reads the current user from the request session.
 */
export default async function DashboardPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="container flex min-h-screen flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-winner/10 text-winner">
        <Radar className="h-6 w-6 animate-pulse-glow" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Winner Product Radar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {user ? (
            <p>
              Signed in as <span className="text-foreground">{user.email}</span>.
              The radar feed arrives in Phase 3.
            </p>
          ) : (
            <p>
              No active session. Authentication UI ships with Phase 3 — the
              server and middleware Supabase clients are already wired.
            </p>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/">← Back home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
