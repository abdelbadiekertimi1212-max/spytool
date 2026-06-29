import { defineConfig, devices } from "@playwright/test";

/**
 * Production-like E2E. `globalSetup` provisions deterministic fixtures
 * (scripts/reset-test-env.ts); the `setup` project authenticates the subscriber
 * and saves storage state; the `chromium` project reuses it. `globalTeardown`
 * removes the fixtures (set E2E_KEEP_DATA=true to keep them for debugging).
 *
 * Run: npm run test:e2e   (needs a dev server + Supabase + SUPABASE_SERVICE_ROLE_KEY)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/ar",
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/subscriber.json",
      },
      dependencies: ["setup"],
    },
  ],
});
