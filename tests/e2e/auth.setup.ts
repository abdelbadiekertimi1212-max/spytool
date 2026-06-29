import { test as setup, expect } from "@playwright/test";

import { E2E_USERS, E2E_PASSWORD } from "../../scripts/reset-test-env";

const STORAGE = "tests/e2e/.auth/subscriber.json";

setup("authenticate the active subscriber", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(E2E_USERS.subscriber.email);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: STORAGE });
});
