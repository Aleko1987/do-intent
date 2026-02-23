import { api } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db } from "../db/db";
import { applyCorrelationId } from "../internal/correlation";

interface MarketingLeadsColumn {
  name: string;
  data_type: string;
  is_nullable: string;
  default: string | null;
}

interface MarketingLeadsSchemaResponse {
  tableExists: boolean;
  columns: MarketingLeadsColumn[];
}

function getHeaderValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

function hasValidDoIntentApiKey(headerKey: string | undefined): boolean {
  const expectedKey = process.env.DO_INTENT_API_KEY?.trim();
  const providedKey = headerKey?.trim();

  if (!expectedKey || !providedKey) {
    return false;
  }

  return providedKey === expectedKey;
}

async function serveDebugMarketingLeadsSchema(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const startedAt = Date.now();
  const corr = applyCorrelationId(req, res);

  try {
    const providedApiKey = getHeaderValue(req, "x-do-intent-key");

    if (!hasValidDoIntentApiKey(providedApiKey)) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ code: "forbidden", message: "forbidden", corr }));
      return;
    }

    // TEMP DEBUG: remove after schema fixed
    const columns = await db.rawQueryAll<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'marketing_leads'
       ORDER BY ordinal_position`
    );

    const response: MarketingLeadsSchemaResponse = {
      tableExists: columns.length > 0,
      columns: columns.map((column) => ({
        name: column.column_name,
        data_type: column.data_type,
        is_nullable: column.is_nullable,
        default: column.column_default,
      })),
    };

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(response));
  } catch (error) {
    const err = error instanceof Error ? error : new Error("unknown error");
    console.error("[debug-marketing-leads-schema] error", {
      corr,
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ code: "internal", message: "Internal Server Error", corr }));
  } finally {
    console.info("[debug-marketing-leads-schema] end", {
      corr,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  }
}

export const debugMarketingLeadsSchema = api.raw(
  { expose: true, method: "GET", path: "/debug/schema/marketing-leads" },
  serveDebugMarketingLeadsSchema
);
