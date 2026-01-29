import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getPool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "migrations");

async function ensureSchemaMigrationsTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool: Awaited<ReturnType<typeof getPool>>): Promise<Set<string>> {
  const result = await pool.query<{ migration: string }>(
    "SELECT migration FROM schema_migrations ORDER BY migration"
  );
  return new Set(result.rows.map((row) => row.migration));
}

async function applyMigration(
  pool: Awaited<ReturnType<typeof getPool>>,
  filename: string,
  sql: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (migration) VALUES ($1)",
        [filename]
      );
      await client.query("COMMIT");
      console.log(`✓ Applied migration: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

async function runMigrations(): Promise<void> {
  const pool = getPool();

  try {
    // Ensure schema_migrations table exists
    console.log("Ensuring schema_migrations table exists...");
    await ensureSchemaMigrationsTable(pool);

    // Get list of applied migrations
    const appliedMigrations = await getAppliedMigrations(pool);
    console.log(`Found ${appliedMigrations.size} already applied migration(s)`);

    // Read migration files
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFiles = files
      .filter((file) => file.endsWith(".up.sql"))
      .sort(); // Sort ascending

    console.log(`Found ${migrationFiles.length} migration file(s) to check`);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`⊘ Skipping already applied: ${filename}`);
        skippedCount++;
        continue;
      }

      const filePath = join(MIGRATIONS_DIR, filename);
      const sql = await readFile(filePath, "utf-8");

      if (!sql.trim()) {
        console.log(`⚠ Skipping empty migration: ${filename}`);
        skippedCount++;
        continue;
      }

      try {
        await applyMigration(pool, filename, sql);
        appliedCount++;
      } catch (error) {
        console.error(`✗ Failed to apply migration ${filename}:`, error);
        throw error;
      }
    }

    console.log(`\nMigration summary:`);
    console.log(`  Applied: ${appliedCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Total: ${migrationFiles.length}`);
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

