import { setRequestLocale } from "next-intl/server";
import { Workflow, AlertTriangle, Timer, Loader2 } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { getJobHealth } from "@/lib/queue/metrics";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Inline (avoid importing boss.ts, which pulls pg-boss into the web build).
const queueOn = process.env.ENABLE_QUEUE === "true";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default async function JobsHealthPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const admin = createAdminClient();
  const summaries = await getJobHealth(admin);

  const totals = summaries.reduce(
    (acc, s) => {
      acc.runs += s.runs;
      acc.failures += s.failures;
      acc.active += s.active;
      return acc;
    },
    { runs: 0, failures: 0, active: 0 }
  );

  const cards = [
    { icon: Workflow, label: "Runs (recent)", value: totals.runs },
    { icon: Loader2, label: "Running", value: totals.active },
    { icon: AlertTriangle, label: "Failed", value: totals.failures },
    { icon: Timer, label: "Stages tracked", value: summaries.length },
  ];

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center gap-2">
        <Workflow className="h-5 w-5 text-winner" />
        <h1 className="text-2xl font-bold tracking-tight">Engine Jobs</h1>
        <Badge variant={queueOn ? "winner" : "secondary"}>
          {queueOn ? "queue on" : "queue off (cron)"}
        </Badge>
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
        <CardContent className="space-y-2 p-4">
          <h2 className="mb-2 text-sm font-semibold">Per-stage</h2>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No queue runs recorded yet. The pipeline runs via GitHub Actions cron until
              ENABLE_QUEUE=true and a worker (`npm run queue:work`) is deployed.
            </p>
          ) : (
            summaries.map((s) => (
              <div
                key={s.job}
                className="flex items-center gap-3 border-b border-border/40 py-1.5 text-xs last:border-0"
              >
                <span className="w-20 shrink-0 font-medium">{s.job}</span>
                <Badge
                  variant={
                    s.lastStatus === "failed"
                      ? "destructive"
                      : s.lastStatus === "active"
                        ? "secondary"
                        : "winner"
                  }
                  className="shrink-0 text-[10px]"
                >
                  {s.lastStatus}
                </Badge>
                <span className="text-muted-foreground">{timeAgo(s.lastRunAt)}</span>
                <span className="ml-auto text-muted-foreground">
                  {s.runs} runs · {s.failures} failed · ~{Math.round(s.avgDurationMs / 1000)}s
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
