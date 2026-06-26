import { config } from "dotenv";

/**
 * Load env for standalone engine scripts. Reads `.env.local` first (Next.js
 * convention) then `.env` as a fallback. Variables already present in the real
 * environment (e.g. GitHub Actions secrets) are never overridden.
 */
config({ path: ".env.local" });
config();
