import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/supabase";

type Client = SupabaseClient<Database>;
type Level = "info" | "warn" | "error";

/**
 * Best-effort structured engine logger. Mirrors to the console AND persists to
 * the `engine_logs` table so silent failures in the scraper/persistence layers
 * are queryable without terminal access (e.g. from the Supabase dashboard:
 * `select * from engine_logs where level = 'error' order by created_at desc`).
 *
 * NEVER throws — logging must not break the pipeline.
 */
export async function logEngine(
  client: Client,
  level: Level,
  scope: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  const line = `[${scope}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  try {
    await client.from("engine_logs").insert({
      level,
      scope,
      message: message.slice(0, 2000),
      context: (context ?? null) as Database["public"]["Tables"]["engine_logs"]["Insert"]["context"],
    });
  } catch {
    // DB logging is best-effort; swallow so the caller is never affected.
  }
}
