import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Runs the auth/paywall/dashboard smoke flows against a dev server.
 * Run locally with: npm run test:e2e
 * (Kept out of the main CI coverage job; gated separately because it needs a
 * running server + a seeded test user.)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
