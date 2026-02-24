import express from "express";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";

type TrackPayload = {
  event?: string;
  session_id?: string;
  anonymous_id?: string;
  url?: string;
  referrer?: string;
  timestamp?: string;
  value_1?: number;
  metadata?: Record<string, unknown>;
};

type TrackResponse = {
  ok: true;
  stored: boolean;
  reason?: "db_disabled";
  error?: "db_error";
  request_id: string;
};

const app = express();
app.use(express.json({ limit: "1mb" }));

let pool: Pool | null = null;

type MarketingLeadColumn = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
};

function isDbEnabled(): boolean {
  return (process.env.ENABLE_DB || "").toLowerCase() === "true";
}

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
}

async function logMarketingLeadsSchema(): Promise<void> {
  const activePool = getPool();
  if (!activePool) {
    return;
  }

  try {
    const result = await activePool.query<MarketingLeadColumn>(
      `
        select column_name, data_type, is_nullable, column_default
        from information_schema.columns
        where table_schema='public' and table_name='marketing_leads'
        order by ordinal_position
      `
    );

    if (result.rows.length === 0) {
      console.log("[schema] marketing_leads: table not found");
      return;
    }

    console.log(
      `[schema] marketing_leads columns: ${JSON.stringify(result.rows)}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[schema] marketing_leads introspection failed: ${message}`);
  }
}

async function ensureMarketingLeadsSchema(): Promise<void> {
  const activePool = getPool();
  if (!activePool) {
    return;
  }

  // TEMP: remove once migrations are fixed
  const statements = [
    "alter table marketing_leads add column if not exists company_name text",
    "alter table marketing_leads add column if not exists source_type text",
    "alter table marketing_leads add column if not exists apollo_lead_id text",
    "alter table marketing_leads add column if not exists created_at timestamptz default now()",
    "alter table marketing_leads add column if not exists updated_at timestamptz default now()",
  ];

  for (const statement of statements) {
    try {
      await activePool.query(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[schema] marketing_leads ensure failed: ${message}`);
    }
  }

  console.log(
    "[schema] ensured marketing_leads columns ok (including apollo_lead_id)"
  );
}

function logRequest({
  requestId,
  stored,
  dbEnabled,
  error,
}: {
  requestId: string;
  stored: boolean;
  dbEnabled: boolean;
  error?: string;
}): void {
  console.log(
    `request_id=${requestId} stored=${stored} dbEnabled=${dbEnabled} error=${
      error ?? "none"
    }`
  );
}

app.get("/ready", (_req, res) => {
  const requestId = uuidv4();
  const dbEnabled = isDbEnabled();

  logRequest({ requestId, stored: false, dbEnabled });
  res.status(200).json({ ok: true, request_id: requestId });
});

app.post("/track", async (req, res) => {
  const requestId = uuidv4();
  const dbEnabled = isDbEnabled();
  const payload = (req.body ?? {}) as TrackPayload;

  if (!dbEnabled) {
    const response: TrackResponse = {
      ok: true,
      stored: false,
      reason: "db_disabled",
      request_id: requestId,
    };
    logRequest({ requestId, stored: false, dbEnabled, error: "db_disabled" });
    res.status(200).json(response);
    return;
  }

  const activePool = getPool();
  if (!activePool) {
    const response: TrackResponse = {
      ok: true,
      stored: false,
      error: "db_error",
      request_id: requestId,
    };
    logRequest({ requestId, stored: false, dbEnabled, error: "db_error" });
    res.status(200).json(response);
    return;
  }

  const event = typeof payload.event === "string" ? payload.event.trim() : "";
  const sessionId =
    typeof payload.session_id === "string" ? payload.session_id.trim() : "";
  const anonymousId =
    typeof payload.anonymous_id === "string"
      ? payload.anonymous_id.trim()
      : "";
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const referrer =
    typeof payload.referrer === "string" ? payload.referrer.trim() : null;
  const timestamp =
    typeof payload.timestamp === "string" && payload.timestamp.trim()
      ? new Date(payload.timestamp)
      : new Date();
  const metadata = payload.metadata && typeof payload.metadata === "object"
    ? payload.metadata
    : {};

  let stored = false;
  let error: TrackResponse["error"] | undefined;

  try {
    if (!event || !sessionId || !anonymousId || !url) {
      throw new Error("missing_required_fields");
    }

    await activePool.query(
      `
        INSERT INTO sessions (
          session_id,
          anonymous_id,
          last_seen_at
        ) VALUES ($1, $2, now())
        ON CONFLICT (session_id) DO UPDATE
        SET anonymous_id = EXCLUDED.anonymous_id,
            last_seen_at = now()
      `,
      [sessionId, anonymousId]
    );

    await activePool.query(
      `
        INSERT INTO events (
          event_type,
          session_id,
          anonymous_id,
          url,
          referrer,
          occurred_at,
          event_value,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        event,
        sessionId,
        anonymousId,
        url,
        referrer,
        timestamp.toISOString(),
        typeof payload.value_1 === "number" ? payload.value_1 : null,
        JSON.stringify(metadata),
      ]
    );

    stored = true;
  } catch (dbError) {
    error = "db_error";
  }

  const response: TrackResponse = stored
    ? { ok: true, stored: true, request_id: requestId }
    : { ok: true, stored: false, error: "db_error", request_id: requestId };

  logRequest({ requestId, stored, dbEnabled, error });
  res.status(200).json(response);
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => {
  console.log(`[web] listening on ${port}`);
  void logMarketingLeadsSchema();
  void ensureMarketingLeadsSchema();
});
