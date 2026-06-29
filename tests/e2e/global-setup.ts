import { resetTestEnv } from "../../scripts/reset-test-env";

/** Provision deterministic E2E fixtures (users + catalog) before the suite. */
export default async function globalSetup() {
  await resetTestEnv();
}
