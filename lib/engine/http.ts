import { engineConfig, USER_AGENTS } from "./config";

/** Sleep for a fixed number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Randomized polite delay between requests to avoid hammering small stores. */
export function jitter(): Promise<void> {
  const { minDelayMs, maxDelayMs } = engineConfig;
  const ms = Math.floor(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
  return sleep(ms);
}

export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Realistic browser-like headers for a given referer origin. */
export function stealthHeaders(origin?: string): Record<string, string> {
  return {
    "User-Agent": randomUserAgent(),
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "fr-FR,fr;q=0.9,ar;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(origin ? { Referer: origin, Origin: origin } : {}),
  };
}

/**
 * fetch() with a timeout, stealth headers and JSON/text helpers. Throws on
 * non-2xx unless `allowedStatuses` includes the returned status (used by the
 * Shopify cart threshold probe, which deliberately expects a 422).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { allowedStatuses?: number[]; origin?: string } = {}
): Promise<Response> {
  const { allowedStatuses = [], origin, headers, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    engineConfig.requestTimeoutMs
  );

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: { ...stealthHeaders(origin), ...(headers as object) },
    });

    if (!response.ok && !allowedStatuses.includes(response.status)) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Make scraped free-text safe for Postgres/PostgREST insertion. PostgREST
 * populates rows through Postgres JSON functions, so a NUL byte, a stray
 * control char, or a lone UTF-16 surrogate (e.g. from naive truncation that
 * splits an emoji) triggers "invalid input syntax for type json".
 *
 * Iterating with for..of yields whole code points, so valid emoji (surrogate
 * pairs) are preserved while lone surrogates surface as a single 0xD800-0xDFFF
 * code point and are dropped. Truncation counts code points, never splitting a pair.
 */
export function sanitizeText(
  value: string | null | undefined,
  maxLen = 2000
): string | null {
  if (value === null || value === undefined) return null;
  const out: string[] = [];
  for (const ch of String(value)) {
    const code = ch.codePointAt(0) ?? 0;
    // Skip C0 controls except tab (9), newline (10), carriage return (13).
    if (code < 0x20 && code !== 9 && code !== 10 && code !== 13) continue;
    // Skip DEL + C1 control range.
    if (code >= 0x7f && code <= 0x9f) continue;
    // Skip lone surrogates (paired surrogates already merged into one code point).
    if (code >= 0xd800 && code <= 0xdfff) continue;
    out.push(ch);
    if (out.length >= maxLen) break;
  }
  return out.join("").trim();
}

export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/** Coerce a Shopify-style money string/number into a float or null. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}
