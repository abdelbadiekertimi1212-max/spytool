import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/supabase/subscription";
import { getDashboardAnalytics } from "@/lib/engine/osint";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { WinnerFeed } from "@/components/dashboard/winner-feed";
import { UpsellGate } from "@/components/dashboard/upsell-gate";
import type { WinnerProduct } from "@/lib/dashboard/types";

export const dynamic = "force-dynamic";

export default async function WinnersPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();

  // Paywall: RLS hides the catalog without an active sub; show an upsell here.
  const sub = await getSubscriptionState(supabase);
  if (!sub.active) {
    return (
      <div className="container py-8">
        <UpsellGate />
      </div>
    );
  }
  // Run the market-intelligence aggregation and the winner feed query in
  // parallel. Each product carries its store + ads so cards render real ads.
  const [{ data }, analytics] = await Promise.all([
    supabase
      .from("products")
      .select("*, store:stores(*, ads(*))")
      .order("is_winner", { ascending: false })
      .order("daily_velocity", { ascending: false })
      .order("first_seen_at", { ascending: false })
      .limit(200),
    getDashboardAnalytics(supabase),
  ]);

  const winners = (data ?? []) as unknown as WinnerProduct[];
  const t = await getTranslations("Dashboard");

  return (
    <div className="container space-y-10 py-8">
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
