import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gauge } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/supabase/subscription";
import { getUsageSummary } from "@/lib/limits/usage";
import { UsagePanel } from "@/components/dashboard/usage-panel";

export const dynamic = "force-dynamic";

export default async function UsagePage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sub = await getSubscriptionState(supabase);
  const usage = user ? await getUsageSummary(supabase, user.id, sub.tier) : [];

  const t = await getTranslations("Usage");

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-winner" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")} · {t("plan")}: <span className="capitalize">{sub.tier}</span>
          </p>
        </div>
      </div>
      <UsagePanel usage={usage} />
    </div>
  );
}
