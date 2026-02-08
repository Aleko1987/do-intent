import { api } from "encore.dev/api";

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

export const getDbInfo = api<EmptyRequest, DbInfoResponse>(
  { expose: true, method: "GET", path: "/api/v1/debug/dbinfo" },
  async () => {
    const dbUrl = process.env.DATABASE_URL;
    const { host, dbname } = parseDatabaseUrl();

    const response: DbInfoResponse = {
      has_database_url: Boolean(dbUrl),
      database_url_host: host,
      database_url_dbname: dbname,
      search_path_current_schema: "",
      found_tables: [],
      found_columns_intent_events: [],
    };

    // Try to query the database, but don't fail if it's not available
    try {
      // Get current schema
      const schemaResult = await db.queryRow<{ current_schema: string }>`
        SELECT current_schema() as current_schema
      `;
      if (schemaResult) {
        response.search_path_current_schema = schemaResult.current_schema || "";
      }

      // Find tables
      const tablesResult = await db.queryAll<{
        table_schema: string;
        table_name: string;
      }>`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_name IN ('intent_events', 'marketing_leads', 'scoring_rules')
        ORDER BY table_schema, table_name
      `;
      response.found_tables = tablesResult || [];

      // Find columns for intent_events (across all schemas)
      const columnsResult = await db.queryAll<{
        column_name: string;
        data_type: string;
      }>`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'intent_events'
        ORDER BY table_schema, ordinal_position
      `;
      response.found_columns_intent_events = columnsResult || [];
    } catch (error) {
      // Database not available or query failed - return empty arrays
      // This is expected behavior when DB is not configured
      console.warn("[debug_dbinfo] Database query failed:", error);
    }

    return response;
  }
);

