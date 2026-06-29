import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/supabase/subscription";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { UpsellGate } from "@/components/dashboard/upsell-gate";
import type { LeadRow } from "@/lib/dashboard/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();

  const sub = await getSubscriptionState(supabase);
  if (!sub.active) {
    return (
      <div className="container py-8">
        <UpsellGate />
      </div>
    );
  }

  const [storesRes, winnersRes, adsRes] = await Promise.all([
    supabase
      .from("stores")
      .select("*")
      .order("lead_score", { ascending: false })
      .limit(200),
    supabase
      .from("products")
      .select("store_id, daily_velocity")
      .eq("is_winner", true),
    supabase.from("ads").select("store_id").eq("is_active", true),
  ]);

  const winners = winnersRes.data ?? [];
  const ads = adsRes.data ?? [];

  const leads: LeadRow[] = (storesRes.data ?? []).map((store) => {
    const storeWinners = winners.filter((w) => w.store_id === store.id);
    const maxVelocity = storeWinners.reduce(
      (max, w) => Math.max(max, w.daily_velocity ?? 0),
      0
    );
    const activeAds = ads.filter((a) => a.store_id === store.id).length;
    return {
      ...store,
      winner_count: storeWinners.length,
      max_velocity: maxVelocity,
      active_ads: activeAds,
    };
  });

  const t = await getTranslations("Leads");

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <LeadsTable leads={leads} />
    </div>
  );
}
