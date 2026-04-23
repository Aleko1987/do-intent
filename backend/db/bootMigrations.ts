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
  const pool = createMigrationPool();
  try {
    await applyPendingMigrationsToPool(pool);
  } finally {
    await pool.end();
  }
  console.info("[db] Startup migrations finished.");
}
