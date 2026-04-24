import { createMigrationPool } from "./db.js";
import { applyPendingMigrationsToPool } from "./applyMigrations.js";

/**
 * When RUN_MIGRATIONS_ON_START=true (e.g. Render without Shell), apply pending
 * migrations once at process startup before the API serves traffic.
 */
export async function runMigrationsIfEnabled(): Promise<void> {
  if (process.env.RUN_MIGRATIONS_ON_START !== "true") {
    return;
  }

  console.info("[db] RUN_MIGRATIONS_ON_START=true — applying pending migrations…");
  try {
    const pool = createMigrationPool();
    try {
      await applyPendingMigrationsToPool(pool);
      console.info("[db] Startup migrations finished.");
    } finally {
      await pool.end();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Keep API startup resilient; operator can run migrations separately if needed.
    console.error(`[db] Startup migrations failed: ${message}`);
  }
}
