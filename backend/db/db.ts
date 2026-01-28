import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Pool } from "pg";

type SqlQuery = { text: string; values: unknown[] };

// Parse DATABASE_URL to configure external connection if present
function parseDatabaseUrlForEncore(): {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
} | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return null;
  }

  try {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 5432,
      user: url.username,
      password: url.password,
      database: url.pathname ? url.pathname.replace(/^\//, "") : undefined,
    };
  } catch {
    return null;
  }
}

// Encore SQLDatabase with migrations configured
// When DATABASE_URL is set, configure external connection to prevent Docker startup.
// If DATABASE_URL is not set, Encore will use its default local database (requires Docker).
const dbConfig = parseDatabaseUrlForEncore();
export const encoreDb = new SQLDatabase("do_intent", {
  migrations: "./migrations",
  host: dbConfig ? dbConfig.host : undefined,
  port: dbConfig ? dbConfig.port : undefined,
  user: dbConfig ? dbConfig.user : undefined,
  password: dbConfig ? dbConfig.password : undefined,
  database: dbConfig ? dbConfig.database : undefined,
});

// Fallback Pool for compatibility with existing code that uses raw queries
let pool: Pool | null = null;
let warnedMissingConfig = false;

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function ensureSslMode(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode) {
      return connectionString;
    }
    if (isLocalHostname(url.hostname)) {
      return connectionString;
    }
    url.searchParams.set("sslmode", "require");
    return url.toString();
  } catch {
    return connectionString;
  }
}

function shouldUseSsl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    if (!sslmode) {
      return false;
    }
    return ["require", "verify-full", "verify-ca"].includes(sslmode);
  } catch {
    return false;
  }
}

function buildQuery(
  strings: TemplateStringsArray,
  values: unknown[]
): SqlQuery {
  let text = "";
  const params: unknown[] = [];

  strings.forEach((chunk, index) => {
    text += chunk;
    if (index < values.length) {
      params.push(values[index]);
      text += `$${params.length}`;
    }
  });

  return { text, values: params };
}

function resolveDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const hostport = process.env.DATABASE_HOSTPORT;
  const name = process.env.DATABASE_NAME;

  if (!user || !password || !hostport || !name) {
    return null;
  }

  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${user}:${encodedPassword}@${hostport}/${name}`;
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = resolveDatabaseUrl();
    if (!connectionString) {
      if (!warnedMissingConfig) {
        warnedMissingConfig = true;
        console.warn(
          "[db] DATABASE_URL (or DATABASE_* components) not configured."
        );
      }
      throw new Error("Database not configured");
    }
    const normalizedConnectionString = ensureSslMode(connectionString);
    pool = new Pool({
      connectionString: normalizedConnectionString,
      ssl: shouldUseSsl(normalizedConnectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

async function queryRow<T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const { text, values: params } = buildQuery(strings, values);
  const result = await getPool().query(text, params);
  return (result.rows[0] ?? null) as T | null;
}

async function queryAll<T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const { text, values: params } = buildQuery(strings, values);
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

function query<T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): AsyncIterable<T> {
  const { text, values: params } = buildQuery(strings, values);
  const promise = getPool().query(text, params);

  async function* generator(): AsyncGenerator<T> {
    const result = await promise;
    for (const row of result.rows) {
      yield row as T;
    }
  }

  return generator();
}

async function rawQueryRow<T>(
  text: string,
  ...params: unknown[]
): Promise<T | null> {
  const result = await getPool().query(text, params);
  return (result.rows[0] ?? null) as T | null;
}

async function rawQueryAll<T>(
  text: string,
  ...params: unknown[]
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

async function exec(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<void> {
  const { text, values: params } = buildQuery(strings, values);
  await getPool().query(text, params);
}

async function rawExec(text: string, ...params: unknown[]): Promise<void> {
  await getPool().query(text, params);
}

export const db = {
  queryRow,
  queryAll,
  query,
  rawQueryRow,
  rawQueryAll,
  exec,
  rawExec,
};
