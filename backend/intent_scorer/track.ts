import { api, APIError, RawRequest, RawResponse } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Pool } from "pg";
import { randomUUID } from "crypto";

interface TrackRequest {
  event?: string;
  session_id?: string;
  anonymous_id?: string;
  url?: string;
  referrer?: string;
  timestamp?: string;
  value?: number;
  metadata?: Record<string, any>;
}

interface TrackResponse {
  ok: true;
  stored?: boolean;
  reason?: "db_disabled" | "db_error";
}

interface InfoResponse {
  ok?: true;
  message: string;
}

interface ErrorResponse {
  code: "invalid_argument" | "internal";
  message: string;
  details?: unknown;
  request_id?: string;
}

let pool: Pool | null = null;
let warnedNoDatabase = false;

let bootstrapPromise: Promise<void> | null = null;

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function ensureIntentEventsTable(activePool: Pool | null): Promise<void> {
  if (!activePool) {
    return;
  }
  if (!bootstrapPromise) {
    bootstrapPromise = activePool
      .query(`
        CREATE TABLE IF NOT EXISTS intent_events (
          id bigserial primary key,
          created_at timestamptz not null default now(),
          event text not null,
          session_id uuid not null,
          anonymous_id uuid null,
          clerk_user_id text null,
          url text null,
          referrer text null,
          ts timestamptz null,
          value double precision null,
          metadata jsonb null
        );
      `)
      .then(() =>
        activePool.query(`
          ALTER TABLE intent_events
          ALTER COLUMN anonymous_id DROP NOT NULL,
          ALTER COLUMN url DROP NOT NULL;
        `)
      )
      .then(() => undefined);
  }

  await bootstrapPromise;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw APIError.invalidArgument(`${field} is required and must be a string`);
  }
  return value.trim();
}

function parseIsoTimestamp(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw APIError.invalidArgument("timestamp must be a valid ISO date string");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw APIError.invalidArgument("timestamp must be a valid ISO date string");
  }

  return parsed;
}

function invalidUuidError(field: string): never {
  throw APIError.invalidArgument(`${field} is required and must be a valid UUID`);
}

function warnDatabaseIssue(message: string, error?: unknown): void {
  if (warnedNoDatabase) {
    return;
  }
  warnedNoDatabase = true;
  if (error) {
    console.warn(message, error);
  } else {
    console.warn(message);
  }
}

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) {
    warnDatabaseIssue(
      "[track] DATABASE_URL is not configured; skipping persistence."
    );
    return null;
  }

  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    } catch (error) {
      warnDatabaseIssue("[track] Failed to initialize database pool.", error);
      return null;
    }
  }

  return pool;
}

function isDbEnabled(): boolean {
  // Render image deploy runs without local Encore SQL; gate DB writes explicitly.
  return process.env.ENABLE_DB === "true";
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureObject(value: unknown, field: string): Record<string, any> | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw APIError.invalidArgument(`${field} must be an object`);
  }
  return value as Record<string, any>;
}

function getCorsOrigin(req: RawRequest): string {
  const origin = req.headers.origin;
  if (Array.isArray(origin)) {
    return origin[0] ?? "*";
  }
  return origin ?? "*";
}

function applyCorsHeaders(resp: RawResponse, req: RawRequest): void {
  resp.setHeader("Access-Control-Allow-Origin", getCorsOrigin(req));
  resp.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, x-do-intent-key, authorization"
  );
  resp.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  resp.setHeader("Vary", "Origin");
}

async function readJsonBody(req: RawRequest): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
  }

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function sendJson(
  resp: RawResponse,
  status: number,
  payload: TrackResponse | InfoResponse | ErrorResponse
): void {
  resp.statusCode = status;
  resp.setHeader("Content-Type", "application/json");
  resp.end(JSON.stringify(payload));
}

async function handleTrack(req: RawRequest, resp: RawResponse): Promise<void> {
  // Generate request_id for correlation
  const request_id = randomUUID();
  
  applyCorsHeaders(resp, req);

  try {
    let payload: TrackRequest;
    try {
      const body = await readJsonBody(req);
      if (typeof body !== "object" || body === null) {
        throw APIError.invalidArgument("body must be a JSON object");
      }
      payload = body as TrackRequest;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.invalidArgument("body must be valid JSON");
    }
    
    // Validate required fields
    const event = requireNonEmptyString(payload.event, "event");

    if (!payload.session_id || !isValidUUID(payload.session_id)) {
      throw APIError.invalidArgument("session_id is required and must be a valid UUID");
    }

    if (payload.anonymous_id && !isValidUUID(payload.anonymous_id)) {
      throw APIError.invalidArgument(
        "anonymous_id must be a valid UUID when provided"
      );
    }

    const url = parseOptionalString(payload.url);
    const referrer = parseOptionalString(payload.referrer);
    const occurredAt = parseIsoTimestamp(payload.timestamp) ?? new Date();
    const metadata = ensureObject(payload.metadata, "metadata");

    let clerkUserId: string | null = null;
    try {
      const authData = getAuthData();
      if (authData?.userID) {
        clerkUserId = authData.userID;
      }
    } catch {
      clerkUserId = null;
    }

    const storedMetadata = metadata ? { ...metadata } : {};
    if (clerkUserId) {
      storedMetadata.clerk_user_id = clerkUserId;
    }

    let stored = false;
    if (!isDbEnabled()) {
      console.warn("DB disabled via ENABLE_DB flag", { request_id });
      sendJson(resp, 200, { ok: true, stored, reason: "db_disabled" });
      return;
    }

    const activePool = getPool();
    if (!activePool) {
      console.warn("[track] Database unavailable; skipping persistence.", {
        request_id,
        hasDb: false,
      });
      sendJson(resp, 200, { ok: true, stored, reason: "db_error" });
      return;
    }

    try {
      await ensureIntentEventsTable(activePool);
      await activePool.query(
        `
          INSERT INTO intent_events (
            event,
            session_id,
            anonymous_id,
            clerk_user_id,
            url,
            referrer,
            ts,
            value,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          event,
          payload.session_id,
          payload.anonymous_id ?? null,
          clerkUserId,
          url,
          referrer,
          occurredAt.toISOString(),
          payload.value ?? null,
          Object.keys(storedMetadata).length > 0
            ? JSON.stringify(storedMetadata)
            : null,
        ]
      );
      stored = true;
    } catch (error) {
      // DB errors are non-fatal - log but don't fail the request
      bootstrapPromise = null;
      const dbError = error instanceof Error ? error : new Error(String(error));
      const pgError = error && typeof error === "object" && "code" in error ? {
        code: (error as any).code,
        detail: (error as any).detail,
        hint: (error as any).hint,
        position: (error as any).position,
      } : null;
      
      console.warn("[track] Failed to record intent event (non-fatal).", {
        request_id,
        error: {
          name: dbError.name,
          message: dbError.message,
          stack: dbError.stack,
          pg: pgError,
        },
      });
      // Continue - return success but stored: false
    }

    sendJson(resp, 200, {
      ok: true,
      stored,
      reason: stored ? undefined : "db_error",
    });
  } catch (error) {
    // Handle validation errors (400)
    if (error instanceof APIError && error.code === "invalid_argument") {
      sendJson(resp, 400, {
        code: "invalid_argument",
        message: error.message,
        request_id,
      });
      return;
    }

    // Handle internal errors (500)
    const fallbackError = error instanceof Error ? error : new Error(String(error));
    const pgError = error && typeof error === "object" && "code" in error ? {
      code: (error as any).code,
      detail: (error as any).detail,
      hint: (error as any).hint,
      position: (error as any).position,
    } : null;
    
    console.error("[track] Internal error.", {
      request_id,
      error: {
        name: fallbackError.name,
        message: fallbackError.message,
        stack: fallbackError.stack,
        pg: pgError,
      },
      hasDb: !!pool,
      envKeys: Object.keys(process.env).filter(
        (key) =>
          key.includes("DATABASE") || key.includes("PG") || key.includes("ENCORE")
      ),
    });
    
    sendJson(resp, 500, {
      code: "internal",
      message: "An internal error occurred while processing the request",
      request_id,
    });
  }
}

export const track = api.raw(
  { expose: true, method: "POST", path: "/track" },
  (req, resp) => {
    void handleTrack(req, resp);
  }
);

export const trackOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/track" },
  (req, resp) => {
    applyCorsHeaders(resp, req);
    resp.statusCode = 200;
    resp.end();
  }
);

export const trackGet = api.raw(
  { expose: true, method: "GET", path: "/track" },
  (req, resp) => {
    applyCorsHeaders(resp, req);
    sendJson(resp, 200, {
      message: "use POST /track",
    });
  }
);

export const trackV1 = api.raw(
  { expose: true, method: "POST", path: "/api/v1/track" },
  (req, resp) => {
    void handleTrack(req, resp);
  }
);

export const trackV1Options = api.raw(
  { expose: true, method: "OPTIONS", path: "/api/v1/track" },
  (req, resp) => {
    applyCorsHeaders(resp, req);
    resp.statusCode = 200;
    resp.end();
  }
);
