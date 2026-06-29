import { test, expect } from "@playwright/test";

import { E2E_USERS, E2E_PASSWORD } from "../../scripts/reset-test-env";

// Fresh anonymous session — we log in as the EXPIRED user to assert the paywall.
test.use({ storageState: { cookies: [], origins: [] } });

test("expired subscriber is gated by the paywall upsell", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(E2E_USERS.expired.email);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
  // RLS hides the catalog; the UpsellGate is shown instead of the feed.
  await expect(page.getByText(/Unlock the Winner Radar/i)).toBeVisible();
});
