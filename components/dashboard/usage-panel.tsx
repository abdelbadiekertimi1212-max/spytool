import { getTranslations } from "next-intl/server";

import type { ResourceUsage, UsageState } from "@/lib/limits/usage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATE_VARIANT: Record<UsageState, "secondary" | "winner" | "destructive"> = {
  healthy: "secondary",
  near: "secondary",
  grace: "winner",
  reached: "destructive",
};

export async function UsagePanel({ usage }: { usage: ResourceUsage[] }) {
  const t = await getTranslations("Usage");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {usage.map((u) => {
        const pct = u.hard ? Math.min(100, Math.round((u.used / u.hard) * 100)) : 0;
        const bar = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-winner" : "bg-winner/70";
        return (
          <Card key={u.resource} className="bg-card/60">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t(`res_${u.resource}`)}</span>
                <Badge variant={STATE_VARIANT[u.state]}>{t(`state_${u.state}`)}</Badge>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {u.used}
                {u.hard !== null ? (
                  <span className="text-sm font-normal text-muted-foreground"> / {u.hard}</span>
                ) : null}
              </div>
              {u.hard !== null ? (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("remaining", { n: u.remaining ?? 0 })}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">{t("unlimited")}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
