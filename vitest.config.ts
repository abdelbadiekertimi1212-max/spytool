import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Absolute project root (ends with a path separator).
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // `@/x` → `<root>/x` (mirrors tsconfig paths).
      { find: /^@\//, replacement: root },
      // Allow importing server modules in the Node test env.
      { find: "server-only", replacement: `${root}tests/mocks/empty.ts` },
      { find: "client-only", replacement: `${root}tests/mocks/empty.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      // Coverage is gated on the critical-path business logic we own — not UI
      // components or browser-driven scrapers (those are covered by E2E).
      include: [
        "lib/engine/winner.ts",
        "lib/engine/text.ts",
        "lib/engine/classifier.ts",
        "lib/engine/resilience.ts",
        "lib/engine/proxy.ts",
        "lib/billing.ts",
        "lib/validation.ts",
        "lib/ratelimit.ts",
        "lib/chargily.ts",
        "lib/supabase/subscription.ts",
        "app/api/**/route.ts",
      ],
      thresholds: {
        statements: 75,
        functions: 75,
        lines: 75,
        branches: 70,
      },
    },
  },
});
