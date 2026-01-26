import { api, RawRequest, RawResponse } from "encore.dev/api";
import { timingSafeEqual } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/db";
import { resolveIngestApiKey } from "../internal/env_secrets";
import type { IntentEvent } from "./types";
import { autoScoreEvent } from "../intent_scorer/auto_score";

// Parse allowed origins from environment
function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_INGEST_ORIGINS;
  if (!origins) {
    return [];
  }
  return origins
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

// Whitelist of allowed event types
const ALLOWED_EVENT_TYPES = [
  "page_view",
  "pricing_view",
  "contact_view",
  "case_study_view",
  "form_start",
  "form_submit",
  "link_click",
  "identify",
];

interface IngestIntentEventPayload {
  event_source?: string;
  event_type?: string;
  occurred_at?: string;
  lead_id?: string;
  anonymous_id?: string;
  url?: string;
  path?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  metadata?: Record<string, any>;
}

interface IngestIntentEventResponse {
  event_id: string;
  lead_id: string | null;
  scored: boolean;
  request_id: string;
}

interface AcceptedResponse {
  ok: true;
  stored: false;
  reason: "db_disabled";
  message: string;
  request_id: string;
}

interface ErrorResponse {
  code: "invalid_argument" | "unauthorized" | "internal" | "missing_secret";
  message: string;
  details?: Record<string, string>;
  request_id: string;
}

interface NormalizedPayload {
  event_type: string;
  event_source: string;
  occurred_at: string;
  lead_id: string | null;
  metadata: Record<string, any>;
}

interface NormalizedDbError {
  name?: string;
  message?: string;
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
}

function makeRequestId(): string {
  return uuidv4();
}

function getRequestId(req: RawRequest): string {
  const headerId = getHeader(req, "x-request-id");
  return headerId && headerId.trim().length > 0 ? headerId : makeRequestId();
}

function isDbEnabled(): boolean {
  return (process.env.ENABLE_DB || "").toLowerCase() === "true";
}

function hasDatabaseConfig(): boolean {
  if (process.env.DATABASE_URL) {
    return true;
  }
  return Boolean(
    process.env.DATABASE_USER &&
      process.env.DATABASE_PASSWORD &&
      process.env.DATABASE_HOSTPORT &&
      process.env.DATABASE_NAME
  );
}

function getHeader(req: RawRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    const max = Math.max(aBuf.length, bBuf.length);
    const paddedA = Buffer.concat([aBuf, Buffer.alloc(max - aBuf.length)]);
    const paddedB = Buffer.concat([bBuf, Buffer.alloc(max - bBuf.length)]);
    timingSafeEqual(paddedA, paddedB);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function checkApiKey(
  req: RawRequest,
  expectedKey: string
): {
  ok: true;
  source: string | null;
  headerReceived: boolean;
} | {
  ok: false;
  message: string;
  headerReceived: boolean;
  details: Record<string, string>;
} {
  const incomingHeader = getHeader(req, "x-ingest-api-key");
  const headerKey = (incomingHeader ?? "").trim();
  const headerReceived = headerKey.length > 0;

  if (!headerReceived) {
    return {
      ok: false,
      message: "missing x-ingest-api-key header",
      headerReceived,
      details: {
        header: "x-ingest-api-key",
      },
    };
  }

  if (!constantTimeEquals(headerKey, expectedKey)) {
    return {
      ok: false,
      message: "invalid ingest api key",
      headerReceived,
      details: {
        header: "x-ingest-api-key",
      },
    };
  }

  return { ok: true, source: "x-ingest-api-key", headerReceived };
}

// Checks origin allowlist
function checkOrigin(origin: string | undefined, referer: string | undefined): {
  ok: true;
} | {
  ok: false;
  message: string;
} {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) {
    return { ok: true };
  }

  // Extract hostname from Origin or Referer
  let hostname: string | null = null;
  if (origin) {
    try {
      const url = new URL(origin);
      hostname = url.hostname;
    } catch {
      // Invalid origin format, ignore
    }
  }
  if (!hostname && referer) {
    try {
      const url = new URL(referer);
      hostname = url.hostname;
    } catch {
      // Invalid referer format, ignore
    }
  }

  if (!hostname) {
    return { ok: false, message: "origin or referer header required" };
  }

  // Check if hostname matches any allowed origin
  const isAllowed = allowedOrigins.some((allowed) => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowed) {
    return { ok: false, message: `origin ${hostname} not in allowlist` };
  }

  return { ok: true };
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
    "content-type, x-ingest-api-key"
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
  payload: IngestIntentEventResponse | AcceptedResponse | ErrorResponse
): void {
  resp.statusCode = status;
  resp.setHeader("Content-Type", "application/json");
  resp.end(JSON.stringify(payload));
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDbError(error: unknown): NormalizedDbError {
  if (!error || typeof error !== "object") {
    return {};
  }
  const err = error as {
    name?: string;
    message?: string;
    code?: string;
    detail?: string;
    constraint?: string;
    table?: string;
    column?: string;
  };

  return {
    name: typeof err.name === "string" ? err.name : undefined,
    message: typeof err.message === "string" ? err.message : undefined,
    code: typeof err.code === "string" ? err.code : undefined,
    detail: typeof err.detail === "string" ? err.detail : undefined,
    constraint: typeof err.constraint === "string" ? err.constraint : undefined,
    table: typeof err.table === "string" ? err.table : undefined,
    column: typeof err.column === "string" ? err.column : undefined,
  };
}

async function withDbOperation<T>(
  operation: string,
  request_id: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("[ingest] db operation failed", {
      request_id,
      operation,
      error: normalizeDbError(error),
    });
    throw error;
  }
}

function validatePayload(
  payload: IngestIntentEventPayload
): { normalized: NormalizedPayload; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const eventType = parseOptionalString(payload.event_type);
  if (!eventType) {
    errors.event_type = "event_type is required";
  } else if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
    errors.event_type = `event_type must be one of: ${ALLOWED_EVENT_TYPES.join(", ")}`;
  }

  const eventSource = parseOptionalString(payload.event_source) ?? "website";

  let occurredAt = payload.occurred_at ?? null;
  if (occurredAt === "") {
    occurredAt = null;
  }
  if (occurredAt !== null && typeof occurredAt !== "string") {
    errors.occurred_at = "occurred_at must be an ISO string";
  } else if (typeof occurredAt === "string") {
    const parsed = new Date(occurredAt);
    if (Number.isNaN(parsed.getTime())) {
      errors.occurred_at = "occurred_at must be a valid ISO string";
    }
  }

  const leadId = parseOptionalString(payload.lead_id);
  const anonymousId = parseOptionalString(payload.anonymous_id);
  if (!leadId && !anonymousId) {
    errors.lead_id = "lead_id or anonymous_id is required";
  }

  if (payload.lead_id && typeof payload.lead_id !== "string") {
    errors.lead_id = "lead_id must be a string";
  }
  if (payload.anonymous_id && typeof payload.anonymous_id !== "string") {
    errors.anonymous_id = "anonymous_id must be a string";
  }

  const url = parseOptionalString(payload.url);
  const path = parseOptionalString(payload.path);
  if (!url && !path) {
    errors.url = "url or path is required";
  }

  if (payload.url && typeof payload.url !== "string") {
    errors.url = "url must be a string";
  }
  if (payload.path && typeof payload.path !== "string") {
    errors.path = "path must be a string";
  }

  if (payload.event_source && typeof payload.event_source !== "string") {
    errors.event_source = "event_source must be a string";
  }

  let metadata: Record<string, any> = {};
  if (payload.metadata !== undefined) {
    if (payload.metadata && typeof payload.metadata === "object") {
      metadata = { ...payload.metadata };
    } else {
      errors.metadata = "metadata must be an object";
    }
  }

  if (payload.anonymous_id) {
    metadata.anonymous_id = payload.anonymous_id;
  }
  if (payload.url) {
    metadata.url = payload.url;
  }
  if (payload.path) {
    metadata.path = payload.path;
  }
  if (payload.referrer) {
    metadata.referrer = payload.referrer;
  }
  if (payload.utm_source) {
    metadata.utm_source = payload.utm_source;
  }
  if (payload.utm_medium) {
    metadata.utm_medium = payload.utm_medium;
  }
  if (payload.utm_campaign) {
    metadata.utm_campaign = payload.utm_campaign;
  }
  if (payload.utm_content) {
    metadata.utm_content = payload.utm_content;
  }

  for (const key of Object.keys(metadata)) {
    if (metadata[key] === "") {
      metadata[key] = null;
    }
  }

  const metadataStr = JSON.stringify(metadata);
  if (metadataStr.length > 16 * 1024) {
    errors.metadata = "metadata exceeds 16kb limit";
  }

  return {
    normalized: {
      event_type: eventType ?? "",
      event_source: eventSource,
      occurred_at: occurredAt ?? new Date().toISOString(),
      lead_id: leadId ?? null,
      metadata,
    },
    errors,
  };
}

async function handleIngestIntentEvent(
  req: RawRequest,
  resp: RawResponse
): Promise<void> {
  const request_id = getRequestId(req);
  applyCorsHeaders(resp, req);

  try {
    const ingestKey = resolveIngestApiKey();
    const isProduction = process.env.NODE_ENV === "production";
    const envFlags = {
      enable_db: isDbEnabled(),
      has_database_url: hasDatabaseConfig(),
      is_production: isProduction,
    };

    console.info("[ingest] request received", {
      request_id,
      method: req.method,
      path: req.url,
      env: envFlags,
    });

    if (isProduction && !ingestKey) {
      console.error("[ingest] ingest api key not configured", {
        request_id,
      });
      sendJson(resp, 500, {
        code: "missing_secret",
        message: "Ingest API key is not configured",
        request_id,
      });
      return;
    }

    if (ingestKey) {
      const authCheck = checkApiKey(req, ingestKey);
      if (!authCheck.ok) {
        console.info("[ingest] unauthorized", {
          request_id,
          db_write_attempted: false,
        });
        sendJson(resp, 401, {
          code: "unauthorized",
          message: authCheck.message,
          details: authCheck.details,
          request_id,
        });
        return;
      }

      if (authCheck.source) {
        console.info(`[ingest] authenticated via ${authCheck.source} header`, {
          request_id,
        });
      }
    }

    const originCheck = checkOrigin(getHeader(req, "origin"), getHeader(req, "referer"));
    if (!originCheck.ok) {
      console.info("[ingest] unauthorized origin", {
        request_id,
        db_write_attempted: false,
      });
      sendJson(resp, 401, {
        code: "unauthorized",
        message: originCheck.message,
        request_id,
      });
      return;
    }

    let payload: IngestIntentEventPayload;
    try {
      const body = await readJsonBody(req);
      if (typeof body !== "object" || body === null) {
        sendJson(resp, 400, {
          code: "invalid_argument",
          message: "body must be a JSON object",
          details: { body: "body must be a JSON object" },
          request_id,
        });
        return;
      }
      payload = body as IngestIntentEventPayload;
    } catch (error) {
      sendJson(resp, 400, {
        code: "invalid_argument",
        message: "body must be valid JSON",
        details: { body: "invalid JSON" },
        request_id,
      });
      return;
    }

    const { normalized, errors } = validatePayload(payload);
    if (Object.keys(errors).length > 0) {
      console.info("[ingest] validation failed", {
        request_id,
        db_write_attempted: false,
      });
      sendJson(resp, 400, {
        code: "invalid_argument",
        message: "invalid request payload",
        details: errors,
        request_id,
      });
      return;
    }

    if (!envFlags.enable_db || !envFlags.has_database_url) {
      console.info("[ingest] DB disabled; accepted without persistence", {
        request_id,
        db_write_attempted: false,
      });
      sendJson(resp, 202, {
        ok: true,
        stored: false,
        reason: "db_disabled",
        message: "event accepted but not persisted",
        request_id,
      });
      return;
    }

    let dbWriteAttempted = false;
    try {
      dbWriteAttempted = true;

      if (normalized.lead_id) {
        const lead = await withDbOperation("lookup_lead", request_id, () =>
          db.queryRow<{ id: string }>`
            SELECT id FROM marketing_leads WHERE id = ${normalized.lead_id}
          `
        );

        if (!lead) {
          sendJson(resp, 400, {
            code: "invalid_argument",
            message: "lead not found",
            details: { lead_id: "lead not found" },
            request_id,
          });
          return;
        }
      }

      const rule = await withDbOperation(
        "lookup_scoring_rule",
        request_id,
        () => db.queryRow<{ points: number }>`
          SELECT points FROM scoring_rules
          WHERE event_type = ${normalized.event_type} AND is_active = true
          LIMIT 1
        `
      );

      const eventValue = rule?.points || 0;

      const event = await withDbOperation(
        "insert_intent_event",
        request_id,
        () => db.queryRow<IntentEvent>`
          INSERT INTO intent_events (
            lead_id,
            event_type,
            event_source,
            event_value,
            metadata,
            occurred_at,
            created_at
          ) VALUES (
            ${normalized.lead_id},
            ${normalized.event_type},
            ${normalized.event_source},
            ${eventValue},
            ${JSON.stringify(normalized.metadata)},
            ${normalized.occurred_at},
            now()
          )
          RETURNING *
        `
      );

      if (!event) {
        console.error("[ingest] Failed to create event", { request_id });
        sendJson(resp, 500, {
          code: "internal",
          message: "db_error",
          request_id,
        });
        return;
      }

      let scored = true;
      try {
        await withDbOperation("auto_score_event", request_id, () =>
          autoScoreEvent(event.id)
        );
      } catch (error) {
        scored = false;
        console.error("[ingest] auto score failed", {
          request_id,
          error: normalizeDbError(error),
        });
      }

      console.info("[ingest] event stored", {
        request_id,
        db_write_attempted: dbWriteAttempted,
      });

      sendJson(resp, 200, {
        event_id: event.id,
        lead_id: event.lead_id,
        scored,
        request_id,
      });
    } catch (error) {
      console.error("[ingest] db error", {
        request_id,
        db_write_attempted: dbWriteAttempted,
        error: normalizeDbError(error),
      });
      sendJson(resp, 500, {
        code: "internal",
        message: "db_error",
        request_id,
      });
    }
  } catch (error) {
    console.error("[ingest] unexpected error", {
      request_id,
      error,
    });
    sendJson(resp, 500, {
      code: "internal",
      message: "an internal error occurred",
      request_id,
    });
  }
}

// Sanity check (curl):
// curl -i -X POST "$BASE_URL/api/v1/ingest" -H "content-type: application/json" \
//   -H "x-ingest-api-key: $INGEST_API_KEY" \
//   -d '{"event_type":"page_view","event_source":"website","lead_id":"<lead-id>","url":"https://example.com"}'

// POST endpoint for ingesting intent events from website
export const ingestIntentEvent = api.raw(
  { expose: true, method: "POST", path: "/marketing/ingest-intent-event" },
  (req, resp) => {
    void handleIngestIntentEvent(req, resp);
  }
);

export const ingestIntentEventV1 = api.raw(
  { expose: true, method: "POST", path: "/api/v1/ingest" },
  (req, resp) => {
    void handleIngestIntentEvent(req, resp);
  }
);

export const ingestIntentEventOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/marketing/ingest-intent-event" },
  (req, resp) => {
    applyCorsHeaders(resp, req);
    resp.statusCode = 204;
    resp.end();
  }
);

export const ingestIntentEventV1Options = api.raw(
  { expose: true, method: "OPTIONS", path: "/api/v1/ingest" },
  (req, resp) => {
    applyCorsHeaders(resp, req);
    resp.statusCode = 204;
    resp.end();
  }
);
