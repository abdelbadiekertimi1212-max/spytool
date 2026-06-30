import { PgBoss } from "pg-boss";

let instance: PgBoss | null = null;

/** Queue is OFF unless explicitly enabled; cron remains the default path. */
export function queueEnabled(): boolean {
  return process.env.ENABLE_QUEUE === "true";
}

/**
 * Singleton pg-boss bound to the existing Postgres (no extra infra). Uses the
 * `pgboss` schema, which pg-boss creates/migrates itself on start(). Point
 * QUEUE_DATABASE_URL at the Supabase **session pooler** connection string.
 */
export async function getBoss(): Promise<PgBoss> {
  if (instance) return instance;
  const connectionString = process.env.QUEUE_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "QUEUE_DATABASE_URL is not set (use the Supabase session pooler connection string)."
    );
  }
  const boss = new PgBoss({ connectionString, schema: "pgboss" });
  boss.on("error", (err: Error) => console.error("[pg-boss]", err.message));
  await boss.start();
  instance = boss;
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (instance) {
    await instance.stop({ graceful: true });
    instance = null;
  }
}
