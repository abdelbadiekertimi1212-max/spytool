import { setRequestLocale } from "next-intl/server";
import { Activity, AlertTriangle, Megaphone, Package, Store } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default async function HealthPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const admin = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const [stores, products, ads, errors24h, recent, lastRun] = await Promise.all([
    admin.from("stores").select("*", head).eq("is_active", true),
    admin.from("products").select("*", head),
    admin.from("ads").select("*", head).eq("is_active", true),
    admin
      .from("engine_logs")
      .select("*", head)
      .eq("level", "error")
      .gte("created_at", since),
    admin
      .from("engine_logs")
      .select("level, scope, message, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("stores")
      .select("last_scraped_at")
      .order("last_scraped_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const cards = [
    { icon: Store, label: "Active stores", value: stores.count ?? 0 },
    { icon: Package, label: "Products", value: products.count ?? 0 },
    { icon: Megaphone, label: "Active ads", value: ads.count ?? 0 },
    { icon: AlertTriangle, label: "Errors (24h)", value: errors24h.count ?? 0 },
  ];

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-winner" />
        <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <Card className="bg-card/60">
        <CardContent className="p-4 text-sm">
          <span className="text-muted-foreground">Last inventory scrape: </span>
          <span className="font-medium">{timeAgo(lastRun.data?.last_scraped_at ?? null)}</span>
        </CardContent>
      </Card>

      <Card className="bg-card/60">
        <CardContent className="space-y-2 p-4">
          <h2 className="mb-2 text-sm font-semibold">Recent engine logs</h2>
          {(recent.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No log entries yet.</p>
          ) : (
            (recent.data ?? []).map((row, i) => (
              <div key={i} className="flex items-start gap-2 border-b border-border/40 py-1.5 text-xs last:border-0">
                <Badge
                  variant={row.level === "error" ? "destructive" : "secondary"}
                  className="shrink-0 text-[10px]"
                >
                  {row.level}
                </Badge>
                <span className="shrink-0 text-muted-foreground">{row.scope}</span>
                <span className="flex-1 truncate" title={row.message ?? ""}>
                  {row.message}
                </span>
                <span className="shrink-0 text-muted-foreground">{timeAgo(row.created_at)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
