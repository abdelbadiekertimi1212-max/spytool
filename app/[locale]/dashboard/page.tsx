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
  // Show all tracked products (winners floated to the top); each product carries
  // its store and the store's ads so the card can render real active creatives.
  const { data } = await supabase
    .from("products")
    .select("*, store:stores(*, ads(*))")
    .order("is_winner", { ascending: false })
    .order("daily_velocity", { ascending: false })
    .order("first_seen_at", { ascending: false })
    .limit(200);

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
