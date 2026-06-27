"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import {
  Store,
  Package,
  Flame,
  Megaphone,
  Layers,
  Crown,
  TrendingUp,
} from "lucide-react";

import type { DashboardAnalytics } from "@/lib/engine/osint";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDZD, formatNumber } from "@/lib/format";

const PLATFORM_COLORS: Record<string, string> = {
  shopify: "#95BF47",
  youcan: "#6366f1",
  storeino: "#f59e0b",
};
const PLATFORM_LABEL: Record<string, string> = {
  shopify: "Shopify",
  youcan: "YouCan",
  storeino: "Storeino",
};

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  color: "hsl(var(--popover-foreground))",
  fontSize: "12px",
};

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <Card className="bg-card/60">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-winner/10 text-winner">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-bold tabular-nums">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsOverview({ data }: { data: DashboardAnalytics }) {
  const t = useTranslations("Analytics");

  const pieData = data.marketShare.filter((s) => s.count > 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={Store} label={t("statStores")} value={formatNumber(data.totals.stores)} />
        <Stat icon={Package} label={t("statProducts")} value={formatNumber(data.totals.products)} />
        <Stat icon={Flame} label={t("statWinners")} value={formatNumber(data.totals.winners)} />
        <Stat icon={Megaphone} label={t("statAds")} value={formatNumber(data.totals.activeAds)} />
        <Stat icon={TrendingUp} label={t("statAvgPrice")} value={formatDZD(data.avgPrice)} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("marketShare")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="platform"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    stroke="transparent"
                    label={(props) => {
                      const e = props as unknown as {
                        platform: string;
                        count: number;
                      };
                      return `${PLATFORM_LABEL[e.platform] ?? e.platform} (${e.count})`;
                    }}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.platform}
                        fill={PLATFORM_COLORS[entry.platform] ?? "#64748b"}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("priceDistribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.priceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }} />
                  <Bar dataKey="count" fill="hsl(var(--winner))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OSINT leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-winner" />
              {t("saturation")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.saturation.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              data.saturation.map((s) => (
                <div
                  key={s.title}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.image ?? ""}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 shrink-0 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                  />
                  <span className="line-clamp-1 flex-1 text-sm" title={s.title}>
                    {s.title}
                  </span>
                  <Badge variant="winner" className="shrink-0">
                    {t("saturationStores", { count: s.storeCount })}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-winner" />
              {t("adStrength")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.adStrength.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              data.adStrength.map((a, i) => (
                <div
                  key={a.storeId}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-2"
                >
                  <span className="w-5 text-center text-sm font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium" title={a.storeName}>
                      {a.storeName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("daysActiveShort", { days: a.daysActive })} ·{" "}
                      {t("adsShort", { count: a.adCount })}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums text-winner">{a.score}</div>
                    <div className="text-[10px] text-muted-foreground">{t("score")}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
