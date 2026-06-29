import { teardownTestEnv } from "../../scripts/reset-test-env";

/** Remove E2E fixtures after the suite (set E2E_KEEP_DATA=true to keep them). */
export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DATA === "true") return;
  await teardownTestEnv();
}
