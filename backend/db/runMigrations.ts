import { createMigrationPool } from "./db.js";
import { applyPendingMigrationsToPool } from "./applyMigrations.js";

async function runMigrations(): Promise<void> {
  const pool = createMigrationPool();

  try {
    console.log("Ensuring schema_migrations table exists...");
    await applyPendingMigrationsToPool(pool);
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
