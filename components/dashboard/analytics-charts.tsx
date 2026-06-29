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

import type { DashboardAnalytics } from "@/lib/engine/osint";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

/**
 * Recharts-based charts, isolated so they can be lazy-loaded (`ssr:false`) and
 * kept off the initial dashboard hydration path — recharts is a heavy bundle.
 */
export function AnalyticsCharts({
  marketShare,
  priceDistribution,
}: {
  marketShare: DashboardAnalytics["marketShare"];
  priceDistribution: DashboardAnalytics["priceDistribution"];
}) {
  const t = useTranslations("Analytics");
  const pieData = marketShare.filter((s) => s.count > 0);

  return (
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
              <BarChart data={priceDistribution}>
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
  );
}
