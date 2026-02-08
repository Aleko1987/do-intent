interface EmptyRequest {
  dummy?: string;
}
import { db } from "../db/db";

interface DbInfoResponse {
  has_database_url: boolean;
  database_url_host: string | null;
  database_url_dbname: string | null;
  search_path_current_schema: string;
  found_tables: Array<{ table_schema: string; table_name: string }>;
  found_columns_intent_events: Array<{ column_name: string; data_type: string }>;
}

function parseDatabaseUrl(): { host: string | null; dbname: string | null } {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return { host: null, dbname: null };
  }

  try {
    const url = new URL(dbUrl);
    const host = url.hostname;
    const dbname = url.pathname ? url.pathname.replace(/^\//, "") : null;
    return { host, dbname };
  } catch {
    return { host: null, dbname: null };
  }
}

export function getDbInfoDisabled(): never {
  throw new Error("debug endpoint disabled");
}

