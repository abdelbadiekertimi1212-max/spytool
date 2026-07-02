import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DollarSign, TrendingUp, Users, Percent } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRevenueKpis } from "@/lib/analytics/revenue";
import { isInternalEmail } from "@/lib/internal";
import { formatDZD, formatNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function RevenuePage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Internal-only — anyone else gets a 404 (no existence leak).
  if (!isInternalEmail(user?.email)) notFound();

  const kpis = await getRevenueKpis(createAdminClient());

  const cards = [
    { icon: DollarSign, label: "MRR", value: formatDZD(kpis.mrr) },
    { icon: TrendingUp, label: "ARR", value: formatDZD(kpis.arr) },
    { icon: DollarSign, label: "ARPU", value: formatDZD(kpis.arpu) },
    { icon: Users, label: "Paying", value: formatNumber(kpis.paying) },
    { icon: Users, label: "Total users", value: formatNumber(kpis.totalUsers) },
    { icon: Percent, label: "Conversion", value: `${kpis.conversionPct.toFixed(1)}%` },
  ];

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Revenue (internal)</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-card/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-winner/10 text-winner">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
