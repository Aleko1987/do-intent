import { api, APIError, RawRequest, RawResponse } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Pool } from "pg";

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
}

interface ErrorResponse {
  code: "invalid_argument" | "internal";
  message: string;
  details?: unknown;
}

let pool: Pool | null = null;
let warnedNoDatabase = false;

let bootstrapPromise: Promise<void> | null = null;

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function ensureIntentEventsTable(): Promise<void> {
  const activePool = getPool();
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

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) {
    if (!warnedNoDatabase) {
      console.warn("[track] DATABASE_URL is not configured; skipping persistence.");
      warnedNoDatabase = true;
    }
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
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
  resp.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
  payload: TrackResponse | ErrorResponse
): void {
  resp.statusCode = status;
  resp.setHeader("Content-Type", "application/json");
  resp.end(JSON.stringify(payload));
}

async function handleTrack(req: RawRequest, resp: RawResponse): Promise<void> {
  applyCorsHeaders(resp, req);

  let payload: TrackRequest;
  try {
    const body = await readJsonBody(req);
    if (typeof body !== "object" || body === null) {
      throw APIError.invalidArgument("body must be a JSON object");
    }
    payload = body as TrackRequest;
  } catch (error) {
    sendJson(resp, 400, {
      code: "invalid_argument",
      message:
        error instanceof APIError ? error.message : "body must be valid JSON",
    });
    return;
  }

  try {
    const event = requireNonEmptyString(payload.event, "event");

    if (!payload.session_id || !isValidUUID(payload.session_id)) {
      invalidUuidError("session_id");
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

    const activePool = getPool();
    if (activePool) {
      try {
        await ensureIntentEventsTable();
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
      } catch (error) {
        console.warn("[track] Failed to record intent event:", error);
      }
    }

    sendJson(resp, 200, { ok: true });
  } catch (error) {
    sendJson(resp, 400, {
      code: "invalid_argument",
      message:
        error instanceof APIError ? error.message : "Invalid tracking payload",
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
