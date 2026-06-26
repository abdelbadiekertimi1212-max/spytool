import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { Pricing } from "@/components/dashboard/pricing";

export const dynamic = "force-dynamic";

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
    .select("status, package_tier")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const t = await getTranslations("Billing");

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Pricing
        currentTier={sub?.package_tier ?? "free"}
        status={sub?.status ?? "trialing"}
      />
    </div>
  );
}
