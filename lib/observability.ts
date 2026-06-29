import "server-only";

import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

/** Correlation id for a request/trace. */
export function requestId(): string {
  return randomUUID();
}

/**
 * Structured (JSON-line) logger — greppable and ingestible by any log backend
 * (Vercel, Loki, etc.) without a paid APM. One line per event.
 */
export function logJson(
  level: LogLevel,
  scope: string,
  message: string,
  meta: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...meta,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}
