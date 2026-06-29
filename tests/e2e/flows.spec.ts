import { test, expect } from "@playwright/test";

// These run with the active-subscriber storage state (see playwright.config.ts).

test("dashboard loads the winner radar for a subscriber", async ({ page }) => {
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  // Analytics overview heading is rendered for active subscribers.
  await expect(page.getByText(/Market Intelligence/i)).toBeVisible();
});

test("checkout flow reaches the billing plans", async ({ page }) => {
  await page.goto("/en/dashboard/billing");
  await expect(page.getByText(/Billing/i).first()).toBeVisible();
  // Upgrade buttons exist; clicking calls /api/checkout (Chargily).
  await expect(page.getByRole("button", { name: /upgrade/i }).first()).toBeVisible();
});

test("outreach modal opens from the leads CRM", async ({ page }) => {
  await page.goto("/en/dashboard/leads");
  const cta = page.getByRole("button", { name: /outreach/i }).first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page.getByRole("button", { name: /generate/i })).toBeVisible();
});

test("user can log out", async ({ page }) => {
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/(login|$)/);
});
