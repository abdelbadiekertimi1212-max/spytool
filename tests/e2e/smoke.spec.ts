import { test, expect } from "@playwright/test";

/**
 * Auth / paywall smoke flow. These don't need a seeded user — they verify the
 * public surface and the auth gate. (Logged-in checkout/logout flows require a
 * seeded test account; add them once a test user is provisioned.)
 */

test("landing page renders the brand", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.getByText("WinnerRadar").first()).toBeVisible();
});

test("login page is reachable and shows the form", async ({ page }) => {
  await page.goto("/ar/login");
  await expect(page.getByLabel(/email|البريد|e-mail/i)).toBeVisible();
});

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/ar/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
