import { test, expect } from "@playwright/test";

// Public surface + auth gate — runs WITHOUT a stored session.
test.use({ storageState: { cookies: [], origins: [] } });

test("landing page renders the brand", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.getByText("WinnerRadar").first()).toBeVisible();
});

test("login page shows the form", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByLabel(/email/i)).toBeVisible();
});

test("dashboard redirects anonymous users to login", async ({ page }) => {
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
