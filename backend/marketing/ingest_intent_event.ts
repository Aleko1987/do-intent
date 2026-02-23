import { api, APIError, Header } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";

interface EmptyRequest {
  dummy?: string;
}
import { timingSafeEqual } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import { resolveIngestApiKey } from "../internal/env_secrets";
import {
  applyCorsHeadersWithOptions,
  parseJsonBody,
} from "../internal/cors";
import { applyCorrelationId } from "../internal/correlation";
import type { IntentEvent } from "./types";
import { autoScoreEvent } from "../intent_scorer/auto_score";
import { updateLeadScoring } from "./scoring";
import { checkAndPushToSales } from "./auto_push";

const WEBSITE_ALLOWED_ORIGINS = ["https://earthcurebiodiesel.com"] as const;

function applyWebsiteCors(req: IncomingMessage, res: ServerResponse): void {
  applyCorsHeadersWithOptions(req, res, {
    allowedOrigins: WEBSITE_ALLOWED_ORIGINS,
    allowAnyOriginFallback: false,
  });
}

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
  dedupe_key?: string;
  url?: string;
  path?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  metadata?: string;
}

interface IngestIntentEventResponse {
  ok: true;
  stored: boolean;
  reason?: "db_disabled";
  message?: string;
  event_id: string;
  lead_id: string | null;
  scored: boolean;
  request_id: string;
}

type AuthHeaderName = "x-do-intent-key" | "x-ingest-api-key" | "authorization";

interface IngestIntentEventRequest extends IngestIntentEventPayload {
  "x-ingest-api-key"?: Header<"x-ingest-api-key">;
  "x-do-intent-key"?: Header<"x-do-intent-key">;
  "origin"?: Header<"origin">;
  "referer"?: Header<"referer">;
  "x-request-id"?: Header<"x-request-id">;
}

interface NormalizedPayload {
  event_type: string;
  event_source: string;
  occurred_at: string;
  lead_id: string | null;
  anonymous_id: string | null;
  dedupe_key: string | null;
  metadata: JsonObject;
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

interface ValidationInvalidField {
  field: string;
  reason: string;
}

interface ValidationFailureLogDetails {
  missing: string[];
  invalid: ValidationInvalidField[];
  receivedTypes: Record<string, string>;
}

function makeRequestId(): string {
  return uuidv4();
}

function getRequestId(headerId: string | undefined): string {
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
  ingestHeaderValue: string | undefined,
  doIntentHeaderValue: string | undefined,
  expectedKey: string,
  acceptedHeaders: Array<"x-ingest-api-key" | "x-do-intent-key"> = ["x-ingest-api-key", "x-do-intent-key"]
): {
  ok: true;
  source: "x-ingest-api-key" | "x-do-intent-key";
  headerReceived: boolean;
  authHeaderNameUsed: AuthHeaderName;
} | {
  ok: false;
  message: string;
  headerReceived: boolean;
  authHeaderNameUsed: AuthHeaderName;
  details: Record<string, string>;
} {
  const ingestHeaderKey = (ingestHeaderValue ?? "").trim();
  const doIntentHeaderKey = (doIntentHeaderValue ?? "").trim();
  const orderedCandidates: Array<{ key: string; source: "x-ingest-api-key" | "x-do-intent-key" }> = [];

  for (const headerName of acceptedHeaders) {
    if (headerName === "x-ingest-api-key") {
      orderedCandidates.push({ key: ingestHeaderKey, source: "x-ingest-api-key" });
    } else {
      orderedCandidates.push({ key: doIntentHeaderKey, source: "x-do-intent-key" });
    }
  }

  const firstProvidedHeader = orderedCandidates.find((candidate) => candidate.key.length > 0);
  const headerKey = firstProvidedHeader?.key ?? "";
  const source = firstProvidedHeader?.source ?? acceptedHeaders[0] ?? "x-do-intent-key";
  const headerReceived = headerKey.length > 0;
  const authHeaderNameUsed: AuthHeaderName = source;

  if (!headerReceived) {
    return {
      ok: false,
      message: "Invalid or missing API key",
      headerReceived,
      authHeaderNameUsed,
      details: { headers: acceptedHeaders.join(",") },
    };
  }

  if (!constantTimeEquals(headerKey, expectedKey)) {
    return {
      ok: false,
      message: "Invalid or missing API key",
      headerReceived,
      authHeaderNameUsed,
      details: { header: source },
    };
  }

  return { ok: true, source, headerReceived, authHeaderNameUsed };
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

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function setMetadataValue(
  metadata: JsonObject,
  key: string,
  value: string | null
): void {
  if (value === null) {
    return;
  }
  const existing = metadata[key];
  if (existing === undefined || existing === null || existing === "") {
    metadata[key] = value;
  }
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

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: string };
  return err.code === "42P01";
}

async function runOptionalScoringStep<T>(
  operation: string,
  request_id: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (isMissingTableError(error)) {
      console.info("[ingest] scoring skipped: missing table", {
        request_id,
        operation,
        error: normalizeDbError(error),
      });
      return null;
    }
    console.error("[ingest] scoring step failed", {
      request_id,
      operation,
      error: normalizeDbError(error),
    });
    throw error;
  }
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
  const payloadAnonymousId = parseOptionalString(payload.anonymous_id);
  let parsedMetadata: JsonObject = {};
  if (payload.metadata !== undefined) {
    if (typeof payload.metadata === "string" && payload.metadata.trim().length > 0) {
      try {
        const parsed = JSON.parse(payload.metadata) as JsonObject;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedMetadata = parsed;
        }
      } catch {
        errors.metadata = "metadata must be a JSON object string";
      }
    } else if (payload.metadata !== "") {
      errors.metadata = "metadata must be a JSON object string";
    }
  }
  const metadataAnonymousId = parseOptionalString(parsedMetadata.anonymous_id);
  const payloadDedupeKey = parseOptionalString(payload.dedupe_key);
  const metadataDedupeKey = parseOptionalString(parsedMetadata.dedupe_key);
  const anonymousId = payloadAnonymousId ?? metadataAnonymousId ?? null;
  const dedupeKey = payloadDedupeKey ?? metadataDedupeKey ?? null;
  if (!leadId && !anonymousId) {
    errors.lead_id = "lead_id or anonymous_id is required";
  }

  if (payload.lead_id && typeof payload.lead_id !== "string") {
    errors.lead_id = "lead_id must be a string";
  }
  if (payload.anonymous_id && typeof payload.anonymous_id !== "string") {
    errors.anonymous_id = "anonymous_id must be a string";
  }

  if (payload.dedupe_key && typeof payload.dedupe_key !== "string") {
    errors.dedupe_key = "dedupe_key must be a string";
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

  let metadata: JsonObject = { ...parsedMetadata };

  // Ensure metadata stays stable; only backfill empty keys from payload fields.
  setMetadataValue(metadata, "anonymous_id", anonymousId);
  setMetadataValue(metadata, "dedupe_key", dedupeKey);
  setMetadataValue(metadata, "url", parseOptionalString(payload.url));
  setMetadataValue(metadata, "path", parseOptionalString(payload.path));
  setMetadataValue(metadata, "referrer", parseOptionalString(payload.referrer));
  setMetadataValue(metadata, "utm_source", parseOptionalString(payload.utm_source));
  setMetadataValue(metadata, "utm_medium", parseOptionalString(payload.utm_medium));
  setMetadataValue(metadata, "utm_campaign", parseOptionalString(payload.utm_campaign));
  setMetadataValue(metadata, "utm_content", parseOptionalString(payload.utm_content));
  setMetadataValue(metadata, "gclid", parseOptionalString(payload.gclid));
  setMetadataValue(metadata, "fbclid", parseOptionalString(payload.fbclid));
  setMetadataValue(metadata, "msclkid", parseOptionalString(payload.msclkid));

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
      anonymous_id: anonymousId,
      dedupe_key: dedupeKey,
      metadata,
    },
    errors,
  };
}

function buildValidationFailureLogDetails(
  payload: IngestIntentEventPayload,
  errors: Record<string, string>
): ValidationFailureLogDetails {
  const missing = new Set<string>();
  const invalid: ValidationInvalidField[] = [];

  for (const [field, message] of Object.entries(errors)) {
    if (message.includes("is required")) {
      if (field === "lead_id") {
        missing.add("lead_id");
        missing.add("anonymous_id");
      } else if (field === "url") {
        missing.add("url");
        missing.add("path");
      } else {
        missing.add(field);
      }
      continue;
    }

    invalid.push({ field, reason: message });
  }

  const receivedTypes: Record<string, string> = {};
  for (const key of Object.keys(payload)) {
    const value = payload[key as keyof IngestIntentEventPayload];
    receivedTypes[key] = Array.isArray(value) ? "array" : typeof value;
  }

  return {
    missing: Array.from(missing),
    invalid,
    receivedTypes,
  };
}

async function handleIngestIntentEvent(
  req: IngestIntentEventRequest,
  acceptedHeaders: Array<"x-ingest-api-key" | "x-do-intent-key"> = ["x-ingest-api-key", "x-do-intent-key"],
  corr?: string
): Promise<IngestIntentEventResponse> {
  const request_id = getRequestId(req["x-request-id"]);
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
      env: envFlags,
    });

    if (isProduction && !ingestKey) {
      console.error("[ingest] ingest api key not configured", {
        request_id,
      });
      throw APIError.internal("Ingest API key is not configured");
    }

    let authenticatedWithApiKey = false;
    if (ingestKey) {
      const authCheck = checkApiKey(
        req["x-ingest-api-key"],
        req["x-do-intent-key"],
        ingestKey,
        acceptedHeaders
      );
      if (authCheck.ok === false) {
        const checkedHeader = (authCheck.details.header ?? authCheck.details.headers ?? acceptedHeaders.join(",")) as string;
        console.info("[ingest] auth check", {
          corr: corr ?? request_id,
          authHeaderNameUsed: authCheck.authHeaderNameUsed,
          authPassed: false,
        });
        console.info("[ingest] auth failed", {
          corr: corr ?? request_id,
          reason: authCheck.headerReceived ? "invalid key" : "missing key",
          headerChecked: checkedHeader,
        });
        console.info("[ingest] unauthorized", {
          request_id,
          db_write_attempted: false,
        });
        throw APIError.unauthenticated(authCheck.message);
      }

      if (authCheck.source) {
        authenticatedWithApiKey = true;
        console.info("[ingest] auth check", {
          corr: corr ?? request_id,
          authHeaderNameUsed: authCheck.authHeaderNameUsed,
          authPassed: true,
        });
        console.info(`[ingest] authenticated via ${authCheck.source} header`, {
          request_id,
        });
      }
    }

    if (!authenticatedWithApiKey) {
      const originCheck = checkOrigin(req.origin, req.referer);
      if (originCheck.ok === false) {
        console.info("[ingest] unauthorized origin", {
          request_id,
          db_write_attempted: false,
        });
        throw APIError.unauthenticated(originCheck.message);
      }
    }

    const { normalized, errors } = validatePayload(req);
    if (Object.keys(errors).length > 0) {
      const validation = buildValidationFailureLogDetails(req, errors);
      console.info("[ingest] validation failed", {
        corr: corr ?? request_id,
        missing: validation.missing,
        invalid: validation.invalid,
        receivedTypes: validation.receivedTypes,
      });
      throw APIError.invalidArgument("invalid request payload");
    }

    if (!envFlags.enable_db || !envFlags.has_database_url) {
      console.info("[ingest] DB disabled; accepted without persistence", {
        request_id,
        db_write_attempted: false,
      });
      return {
        ok: true,
        stored: false,
        reason: "db_disabled",
        message: "event accepted but not persisted",
        event_id: "",
        lead_id: normalized.lead_id,
        scored: false,
        request_id,
      };
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
          throw APIError.invalidArgument("lead not found");
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
            anonymous_id,
            event_type,
            event_source,
            event_value,
            dedupe_key,
            metadata,
            occurred_at,
            created_at
          ) VALUES (
            ${normalized.lead_id},
            ${normalized.anonymous_id},
            ${normalized.event_type},
            ${normalized.event_source},
            ${eventValue},
            ${normalized.dedupe_key},
            ${JSON.stringify(normalized.metadata)},
            ${normalized.occurred_at},
            now()
          )
          RETURNING *
        `
      );

      if (!event) {
        console.error("[ingest] Failed to create event", { request_id });
        throw APIError.internal("db_error");
      }

      let scored = true;
      try {
        const autoScoreResult = await runOptionalScoringStep(
          "auto_score_event",
          request_id,
          () => autoScoreEvent(event.id)
        );
        scored = autoScoreResult ?? false;
        if (event.lead_id) {
          const leadId = event.lead_id;
          await runOptionalScoringStep(
            "update_lead_scoring",
            request_id,
            () => updateLeadScoring(leadId)
          );
          await runOptionalScoringStep(
            "check_and_push_to_sales",
            request_id,
            () => checkAndPushToSales(leadId)
          );
        }
      } catch (error) {
        scored = false;
        console.error("[ingest] scoring pipeline failed", {
          request_id,
          error: normalizeDbError(error),
        });
      }

      console.info("[ingest] event stored", {
        request_id,
        db_write_attempted: dbWriteAttempted,
      });

      return {
        ok: true,
        stored: true,
        event_id: event.id,
        lead_id: event.lead_id,
        scored,
        request_id,
      };
    } catch (error) {
      console.error("[ingest] db error", {
        request_id,
        db_write_attempted: dbWriteAttempted,
        error: normalizeDbError(error),
      });
      throw APIError.internal("db_error");
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    console.error("[ingest] unexpected error", {
      request_id,
      error,
    });
    throw APIError.internal("an internal error occurred");
  }
}

function getHeaderValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

async function serveIngestIntent(
  req: IncomingMessage,
  res: ServerResponse,
  acceptedHeaders: Array<"x-ingest-api-key" | "x-do-intent-key"> = ["x-ingest-api-key", "x-do-intent-key"]
): Promise<void> {
  const startedAt = Date.now();
  const corr = applyCorrelationId(req, res);
  applyWebsiteCors(req, res);
  let errorCode: string | undefined;

  try {
    const payload = await parseJsonBody<IngestIntentEventPayload>(req);
    const hasIngestKey = !!getHeaderValue(req, "x-ingest-api-key");
    const hasDoIntentKey = !!getHeaderValue(req, "x-do-intent-key");
    // Log the specific auth header this endpoint prioritizes, even when missing.
    const authHeaderNameUsed: AuthHeaderName = hasIngestKey ? "x-ingest-api-key" : hasDoIntentKey ? "x-do-intent-key" : acceptedHeaders[0] ?? "x-do-intent-key";

    console.info("[ingest] start", {
      corr,
      method: req.method,
      path: req.url,
      hasAuthHeader: hasIngestKey || hasDoIntentKey,
      authHeaderNameUsed,
      bodyShape: {
        hasEmail: false,
        hasAnonymousId: !!payload?.anonymous_id,
        hasContactName: false,
        hasCompanyName: false,
        hasLeadId: !!payload?.lead_id,
        hasEventType: !!payload?.event_type,
      },
    });

    const request: IngestIntentEventRequest = {
      ...payload,
      "x-ingest-api-key": getHeaderValue(req, "x-ingest-api-key") as Header<"x-ingest-api-key"> | undefined,
      "x-do-intent-key": getHeaderValue(req, "x-do-intent-key") as Header<"x-do-intent-key"> | undefined,
      origin: getHeaderValue(req, "origin") as Header<"origin"> | undefined,
      referer: getHeaderValue(req, "referer") as Header<"referer"> | undefined,
      "x-request-id": getHeaderValue(req, "x-request-id") as Header<"x-request-id"> | undefined,
    };

    const response = await handleIngestIntentEvent(request, acceptedHeaders, corr);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(response));
  } catch (error) {
    if (error instanceof APIError) {
      errorCode = error.code;
      const status = error.code === "invalid_argument" ? 400 :
        error.code === "permission_denied" || error.code === "unauthenticated" ? 401 : 500;
      if (status === 401) {
        const checkedHeader = acceptedHeaders.join(",");
        const authHeaderNameUsed: AuthHeaderName = acceptedHeaders[0] ?? "x-do-intent-key";
        console.info("[ingest] auth failed", {
          corr,
          reason: error.message.toLowerCase().includes("invalid") ? "invalid key" : "missing key",
          headerChecked: checkedHeader,
          authHeaderNameUsed,
          authPassed: false,
        });
      }
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ code: error.code, message: error.message, error: error.message, corr }));

      if (status >= 500) {
        console.error("[ingest] server error", {
          corr,
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      return;
    }

    errorCode = "internal";
    const err = error instanceof Error ? error : new Error("unknown error");
    console.error("[ingest] server error", {
      corr,
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ code: "internal", message: "Internal Server Error", error: "Internal Server Error", corr }));
  } finally {
    console.info("[ingest] end", {
      corr,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
    });
  }
}

export async function serveMarketingIngestIntent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return serveIngestIntent(req, res, ["x-do-intent-key"]);
}

export async function serveIngestIntentV1(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return serveIngestIntent(req, res, ["x-ingest-api-key", "x-do-intent-key"]);
}

export const ingestIntentEvent = api.raw(
  { expose: true, method: "POST", path: "/marketing/ingest-intent-event" },
  serveMarketingIngestIntent
);

export const ingestIntentEventV1 = api.raw(
  { expose: true, method: "POST", path: "/api/v1/ingest" },
  serveIngestIntentV1
);



export const ingestIntentEventOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/marketing/ingest-intent-event" },
  async (req: IncomingMessage, res: ServerResponse) => {
    applyWebsiteCors(req, res);
    res.statusCode = 204;
    res.end();
  }
);

export const ingestIntentEventV1Options = api.raw(
  { expose: true, method: "OPTIONS", path: "/api/v1/ingest" },
  async (req: IncomingMessage, res: ServerResponse) => {
    applyWebsiteCors(req, res);
    res.statusCode = 204;
    res.end();
  }
);
