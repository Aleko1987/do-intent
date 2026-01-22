import { Pool } from "pg";

type SqlQuery = { text: string; values: unknown[] };

let pool: Pool | null = null;
let warnedMissingConfig = false;

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
    pool = new Pool({ connectionString });
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
