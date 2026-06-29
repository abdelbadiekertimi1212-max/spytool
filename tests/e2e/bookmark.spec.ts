import { test, expect } from "@playwright/test";

/**
 * Bookmark scenario. The `bookmarks` table + RLS exist, but the bookmark UI
 * ships with Phase 6 (product). This spec is intentionally pending until that
 * UI lands, so the scenario is tracked but not a false failure.
 */
test.fixme("subscriber can bookmark a winner and see it persist", async ({ page }) => {
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: /bookmark/i }).first().click();
  await expect(page.getByText(/saved/i)).toBeVisible();
});
