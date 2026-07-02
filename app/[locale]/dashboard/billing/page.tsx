import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/limits/usage";
import { getPricingVariant } from "@/lib/experiments";
import { trackServer } from "@/lib/events/collector";
import { Pricing } from "@/components/dashboard/pricing";
import { PlanMatrix } from "@/components/dashboard/plan-matrix";
import { UsagePanel } from "@/components/dashboard/usage-panel";
import { BillingActions } from "@/components/dashboard/billing-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function BillingPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, package_tier, current_period_end, cancel_at_period_end")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const tier = sub?.package_tier ?? "free";
  const usage = user ? await getUsageSummary(supabase, user.id, tier) : [];
  const variant = user ? getPricingVariant(user.id) : "control";

  if (user) trackServer({ event_name: "pricing_open", user_id: user.id, properties: { variant } });

  const t = await getTranslations("Billing");

  return (
    <div className="container space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Current plan summary */}
      <Card className="bg-card/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("currentPlan")}:</span>
              <Badge variant={tier === "free" ? "secondary" : "winner"} className="capitalize">
                {tier}
              </Badge>
              <span className="text-xs text-muted-foreground">({sub?.status ?? "trialing"})</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {sub?.cancel_at_period_end ? t("endsOn") : t("renewsOn")}: {fmtDate(sub?.current_period_end ?? null)}
            </div>
          </div>
          {tier !== "free" ? (
            <BillingActions cancelAtPeriodEnd={Boolean(sub?.cancel_at_period_end)} />
          ) : null}
        </CardContent>
      </Card>

      {/* Usage this period */}
      {usage.length > 0 ? <UsagePanel usage={usage} /> : null}

      {/* Plan comparison + upgrade */}
      <PlanMatrix currentTier={tier} />
      <Pricing currentTier={tier} status={sub?.status ?? "trialing"} variant={variant} />
    </div>
  );
}
