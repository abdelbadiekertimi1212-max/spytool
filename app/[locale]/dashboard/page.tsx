import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/supabase/subscription";
import { getActivationStatus, getUserBookmarkIds } from "@/lib/activation/service";
import { getDashboardAnalytics } from "@/lib/engine/osint";
import { trackServer } from "@/lib/events/collector";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { WinnerFeed } from "@/components/dashboard/winner-feed";
import { UpsellGate } from "@/components/dashboard/upsell-gate";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import type { WinnerProduct } from "@/lib/dashboard/types";

export const dynamic = "force-dynamic";

export default async function WinnersPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Paywall: RLS hides the catalog without an active sub; show an upsell here.
  const sub = await getSubscriptionState(supabase);
  if (!sub.active) {
    return (
      <div className="container py-8">
        <UpsellGate />
      </div>
    );
  }

  // Run the market-intelligence aggregation, the winner feed query, activation
  // status and the user's bookmark set in parallel.
  const [{ data }, analytics, activation, bookmarkIds] = await Promise.all([
    supabase
      .from("products")
      .select("*, store:stores(*, ads(*))")
      .order("is_winner", { ascending: false })
      .order("daily_velocity", { ascending: false })
      .order("first_seen_at", { ascending: false })
      .limit(200),
    getDashboardAnalytics(supabase),
    user ? getActivationStatus(supabase, user.id) : Promise.resolve(null),
    user ? getUserBookmarkIds(supabase, user.id) : Promise.resolve(new Set<string>()),
  ]);

  const winners = (data ?? []).map((p) => ({
    ...p,
    bookmarked: bookmarkIds.has((p as { id: string }).id),
  })) as unknown as WinnerProduct[];
  const t = await getTranslations("Dashboard");

  // Activation funnel signal (server-side, fire-and-forget).
  if (user) trackServer({ event_name: "dashboard_view", user_id: user.id });

  return (
    <div className="container space-y-10 py-8">
      {activation && !activation.onboarded ? <OnboardingCard /> : null}

      <AnalyticsOverview data={analytics} />

      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("winnersTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("winnersSubtitle")}</p>
        </div>
        <WinnerFeed winners={winners} />
      </div>
    </div>
  );
}
