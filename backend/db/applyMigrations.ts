import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "migrations");

export interface MigrationSummary {
  applied: number;
  skipped: number;
  total: number;
}

async function ensureSchemaMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ migration: string }>(
    "SELECT migration FROM schema_migrations ORDER BY migration"
  );
  return new Set(result.rows.map((row) => row.migration));
}

async function applyMigration(
  pool: Pool,
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

export async function applyPendingMigrationsToPool(
  pool: Pool
): Promise<MigrationSummary> {
  await ensureSchemaMigrationsTable(pool);
  const appliedMigrations = await getAppliedMigrations(pool);
  console.log(`Found ${appliedMigrations.size} already applied migration(s)`);

  const files = await readdir(MIGRATIONS_DIR);
  const migrationFiles = files
    .filter((file) => {
      return /^\d{3}_.+\.up\.sql$/.test(file);
    })
    .sort();

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

    await applyMigration(pool, filename, sql);
    appliedCount++;
  }

  console.log(`\nMigration summary:`);
  console.log(`  Applied: ${appliedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Total: ${migrationFiles.length}`);

  return {
    applied: appliedCount,
    skipped: skippedCount,
    total: migrationFiles.length,
  };
}
