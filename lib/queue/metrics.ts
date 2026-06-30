import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";

type Client = SupabaseClient<Database>;
type RunRow = Database["public"]["Tables"]["queue_runs"]["Row"];

export interface RunHandle {
  id: string | null;
  startMs: number;
}

/** Record the start of a job run (active). Best-effort; never throws. */
export async function recordRunStart(
  client: Client,
  jobName: string,
  attempt = 1
): Promise<RunHandle> {
  const startMs = Date.now();
  try {
    const { data } = await client
      .from("queue_runs")
      .insert({ job_name: jobName, status: "active", attempt, started_at: new Date(startMs).toISOString() })
      .select("id")
      .single();
    return { id: data?.id ?? null, startMs };
  } catch {
    return { id: null, startMs };
  }
}

/** Settle a job run (completed/failed) with its duration. Best-effort. */
export async function recordRunEnd(
  client: Client,
  run: RunHandle,
  status: "completed" | "failed",
  error?: string
): Promise<void> {
  if (!run.id) return;
  try {
    await client
      .from("queue_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - run.startMs,
        error: error ? error.slice(0, 500) : null,
      })
      .eq("id", run.id);
  } catch {
    /* metrics are best-effort */
  }
}

export interface JobSummary {
  job: string;
  lastStatus: string;
  lastRunAt: string | null;
  avgDurationMs: number;
  runs: number;
  failures: number;
  active: number;
}

type SummaryRow = Pick<RunRow, "job_name" | "status" | "duration_ms" | "created_at">;

/** Pure aggregation of run rows into per-job health summaries (unit-tested). */
export function summarizeRuns(rows: SummaryRow[]): JobSummary[] {
  const map = new Map<
    string,
    { last: SummaryRow | null; durations: number[]; runs: number; failures: number; active: number }
  >();
  for (const r of rows) {
    let g = map.get(r.job_name);
    if (!g) {
      g = { last: null, durations: [], runs: 0, failures: 0, active: 0 };
      map.set(r.job_name, g);
    }
    g.runs += 1;
    if (r.status === "failed") g.failures += 1;
    if (r.status === "active") g.active += 1;
    if (typeof r.duration_ms === "number") g.durations.push(r.duration_ms);
    if (!g.last || r.created_at > g.last.created_at) g.last = r;
  }
  return Array.from(map.entries()).map(([job, g]) => ({
    job,
    lastStatus: g.last?.status ?? "—",
    lastRunAt: g.last?.created_at ?? null,
    avgDurationMs: g.durations.length
      ? Math.round(g.durations.reduce((a, b) => a + b, 0) / g.durations.length)
      : 0,
    runs: g.runs,
    failures: g.failures,
    active: g.active,
  }));
}

/** Read recent runs and summarize (dashboard /health/jobs). */
export async function getJobHealth(admin: Client, limit = 500): Promise<JobSummary[]> {
  const { data } = await admin
    .from("queue_runs")
    .select("job_name, status, duration_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return summarizeRuns(data ?? []);
}
