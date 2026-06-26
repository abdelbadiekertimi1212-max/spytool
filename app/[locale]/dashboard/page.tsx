import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { WinnerFeed } from "@/components/dashboard/winner-feed";
import type { WinnerProduct } from "@/lib/dashboard/types";

export const dynamic = "force-dynamic";

export default async function WinnersPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*, store:stores(*), ads:ads(*)")
    .eq("is_winner", true)
    .order("daily_velocity", { ascending: false })
    .limit(120);

  const winners = (data ?? []) as unknown as WinnerProduct[];
  const t = await getTranslations("Dashboard");

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("winnersTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("winnersSubtitle")}</p>
      </div>
      <WinnerFeed winners={winners} />
    </div>
  );
}
