import { vi } from "vitest";

export interface MockResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

/**
 * Minimal chainable Supabase client mock. Every query-builder method returns the
 * same builder; the builder is thenable (so `await query` resolves) and exposes
 * `single()` / `maybeSingle()`. Each `.from(table)` resolves to the configured
 * result for that table. Good enough for route/unit tests without a live DB.
 */
export function createSupabaseMock(opts: {
  user?: { id: string; email?: string } | null;
  tables?: Record<string, MockResult>;
} = {}) {
  const tables = opts.tables ?? {};

  function builder(table: string) {
    const result: MockResult = tables[table] ?? { data: null, error: null, count: 0 };
    const chain: Record<string, unknown> = {};
    const chainMethods = [
      "select", "insert", "update", "upsert", "delete",
      "eq", "neq", "gt", "gte", "lt", "lte",
      "in", "is", "like", "ilike", "or", "not", "contains",
      "order", "limit", "range",
    ];
    for (const m of chainMethods) chain[m] = vi.fn(() => chain);
    chain.single = vi.fn(async () => result);
    chain.maybeSingle = vi.fn(async () => result);
    // Thenable so `await builder` resolves to the result.
    chain.then = (resolve: (v: MockResult) => unknown) => resolve(result);
    return chain;
  }

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.user ?? null },
        error: null,
      })),
    },
    from: vi.fn((table: string) => builder(table)),
    // Batch metric updates in computeWinners go through a single SQL RPC.
    rpc: vi.fn(async () => ({ data: null, error: null })),
  };
}
