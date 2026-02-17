import { api, APIError } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";

interface EmptyRequest {
  dummy?: string;
}
import { getAuthData } from "~encore/auth";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { autoScoreEvent } from "./auto_score";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import {
  parseJsonBody,
} from "../internal/cors";

interface TrackRequest {
  event?: string;
  event_id?: string;
  session_id?: string;
  anonymous_id?: string;
  url?: string;
  referrer?: string;
  timestamp?: string;
  value?: number;
  metadata?: string;
}

interface TrackResponse {
  ok: true;
  stored?: boolean;
  reason?: "db_disabled" | "db_error";
  error_code?: string;
  error_message?: string;
  request_id: string;
}

interface InfoResponse {
  ok?: true;
  message: string;
}

let pool: Pool | null = null;
let warnedNoDatabase = false;

let bootstrapPromise: Promise<void> | null = null;

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function ensureTrackingTables(activePool: Pool | null): Promise<void> {
  if (!activePool) {
    return;
  }
  if (!bootstrapPromise) {
    bootstrapPromise = activePool
      .query(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
      `)
      .then(() =>
        activePool.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            session_id UUID PRIMARY KEY,
            anonymous_id UUID NOT NULL,
            identity_id UUID NULL,
            first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            user_agent TEXT NULL,
            device TEXT NULL,
            country TEXT NULL,
            ip TEXT NULL,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb
          );
        `)
      )
      .then(() =>
        activePool.query(`
          CREATE TABLE IF NOT EXISTS events (
            event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
            anonymous_id UUID NOT NULL,
            identity_id UUID NULL,
            event_type TEXT NOT NULL,
            event_value NUMERIC NULL,
            url TEXT NOT NULL,
            referrer TEXT NULL,
            occurred_at TIMESTAMPTZ NOT NULL,
            received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb
          );
        `)
      )
      .then(() =>
        activePool.query(`
          CREATE INDEX IF NOT EXISTS idx_sessions_anonymous_id_last_seen
          ON sessions (anonymous_id, last_seen_at DESC);
        `)
      )
      .then(() =>
        activePool.query(`
          CREATE INDEX IF NOT EXISTS idx_events_anonymous_id_occurred
          ON events (anonymous_id, occurred_at DESC);
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
  return (process.env.ENABLE_DB || "").toLowerCase() === "true";
}

const dbEnabledAtStartup = isDbEnabled();
console.info("[track] ENABLE_DB flag at startup.", {
  enabled: dbEnabledAtStartup,
});

function logDbError(
  message: string,
  request_id: string,
  error_code: string,
  error?: unknown
): void {
  const pgError =
    error && typeof error === "object" && "code" in error
      ? {
          code: (error as any).code,
        }
      : null;

  console.error(message, {
    request_id,
    error_code,
    error: {
      pg: pgError,
    },
  });
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return null;
  }
  return num;
}

function shouldCreateIntentEvent(eventType: string, value: number | null): boolean {
  if (eventType === "time_on_page") {
    return (value ?? 0) >= 30;
  }
  if (eventType === "scroll_depth") {
    return (value ?? 0) >= 60;
  }
  return true;
}

function shouldDerivePricingView(eventType: string, url: string): boolean {
  if (eventType !== "page_view" && eventType !== "click") {
    return false;
  }
  return url.includes("/pricing");
}

type EventClass = "conversion" | "engagement" | "browse";

function classifyEvent(
  eventType: string,
  url: string,
  metadata: JsonObject
): EventClass {
  const pageClassRaw =
    typeof metadata.page_class === "string" ? metadata.page_class : "";
  const pageClass = pageClassRaw.toLowerCase();

  if (eventType === "form_submit") return "conversion";
  if (eventType === "form_start") return "engagement";
  if (eventType === "pricing_view") return "engagement";
  if (eventType === "click" && url.includes("/pricing")) return "engagement";

  if (pageClass.includes("pricing") || pageClass.includes("product")) {
    return "engagement";
  }
  if (pageClass.includes("docs") || pageClass.includes("blog")) {
    return "browse";
  }

  return "browse";
}

function halfLifeSecondsForEventClass(eventClass: EventClass): number {
  // Exponential decay half-lives (Stage 1 v1)
  // - conversion: decays slowest (high intent)
  // - engagement: medium
  // - browse: fastest (low intent)
  switch (eventClass) {
    case "conversion":
      return 21 * 24 * 60 * 60; // 21 days
    case "engagement":
      return 7 * 24 * 60 * 60; // 7 days
    case "browse":
    default:
      return 2 * 24 * 60 * 60; // 2 days
  }
}

const SUBJECT_SCORE_CAP = 60;

async function upsertAnonymousSubjectScore(
  anonymousId: string,
  scoreDelta: number,
  occurredAt: string,
  eventType: string,
  url: string,
  metadata: JsonObject
): Promise<void> {
  if (scoreDelta === 0) {
    return;
  }
  const eventClass = classifyEvent(eventType, url, metadata);
  const halfLifeSeconds = halfLifeSecondsForEventClass(eventClass);
  const delta = Math.max(0, Math.round(scoreDelta));
  const scoreCap = SUBJECT_SCORE_CAP;
  await db.exec`
    INSERT INTO intent_subject_scores (
      subject_type,
      subject_id,
      total_score,
      last_event_at,
      updated_at
    ) VALUES (
      'anonymous',
      ${anonymousId},
      LEAST(${scoreCap}::integer, ${delta}::integer),
      ${occurredAt},
      now()
    )
    ON CONFLICT (subject_type, subject_id) DO UPDATE SET
      total_score = LEAST(
        ${scoreCap}::integer,
        ROUND(
          GREATEST(
            0,
            CASE
              WHEN intent_subject_scores.last_event_at IS NULL THEN intent_subject_scores.total_score
              ELSE intent_subject_scores.total_score * POWER(
                0.5,
                GREATEST(
                  0,
                  EXTRACT(EPOCH FROM (${occurredAt}::timestamptz - intent_subject_scores.last_event_at))
                ) / ${halfLifeSeconds}::numeric
              )
            END
          )
        ) + (
          CASE
            WHEN intent_subject_scores.last_event_at IS NULL THEN ${delta}::integer
            ELSE
              CASE
                WHEN (
                  intent_subject_scores.total_score * POWER(
                    0.5,
                    GREATEST(
                      0,
                      EXTRACT(EPOCH FROM (${occurredAt}::timestamptz - intent_subject_scores.last_event_at))
                    ) / ${halfLifeSeconds}::numeric
                  )
                ) >= ${scoreCap}::integer THEN 0
                WHEN (
                  intent_subject_scores.total_score * POWER(
                    0.5,
                    GREATEST(
                      0,
                      EXTRACT(EPOCH FROM (${occurredAt}::timestamptz - intent_subject_scores.last_event_at))
                    ) / ${halfLifeSeconds}::numeric
                  )
                ) >= ${scoreCap}::integer * 0.8 THEN CEIL(${delta}::numeric * 0.2)
                WHEN (
                  intent_subject_scores.total_score * POWER(
                    0.5,
                    GREATEST(
                      0,
                      EXTRACT(EPOCH FROM (${occurredAt}::timestamptz - intent_subject_scores.last_event_at))
                    ) / ${halfLifeSeconds}::numeric
                  )
                ) >= ${scoreCap}::integer * 0.6 THEN CEIL(${delta}::numeric * 0.5)
                ELSE ${delta}::integer
              END
          END
        )
      )::integer,
      last_event_at = GREATEST(intent_subject_scores.last_event_at, ${occurredAt}),
      updated_at = now()
  `;
}

function getDbErrorCode(error?: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as any).code);
    return `pg_${code}`;
  }
  return "db_query_failed";
}

function parseMetadata(raw: unknown): JsonObject {
  if (raw === undefined || raw === null || raw === "") {
    return {};
  }
  if (typeof raw !== "string") {
    throw APIError.invalidArgument("metadata must be a JSON string");
  }
  try {
    const parsed = JSON.parse(raw) as JsonObject;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fall through
  }
  throw APIError.invalidArgument("metadata must be a JSON object string");
}

async function insertIntentEvent(
  activePool: Pool,
  params: {
    eventType: string;
    eventSource: string;
    eventValue: number | null;
    anonymousId: string;
    occurredAt: string;
    metadata: JsonObject;
    dedupeKey?: string | null;
  }
): Promise<string | null> {
  const normalizedValue =
    params.eventValue === null ? 0 : Math.round(params.eventValue);

  const result = await activePool.query(
    `
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (event_source, dedupe_key)
        WHERE dedupe_key IS NOT NULL
        DO NOTHING
      RETURNING id
    `,
    [
      null,
      params.anonymousId,
      params.eventType,
      params.eventSource,
      normalizedValue,
      params.dedupeKey ?? null,
      JSON.stringify(params.metadata),
      params.occurredAt,
    ]
  );

  return result.rows[0]?.id ?? null;
}

async function scoreAndUpdateSubject(
  intentEventId: string,
  anonymousId: string,
  occurredAt: string,
  eventType: string,
  url: string,
  metadata: JsonObject
): Promise<void> {
  try {
    await autoScoreEvent(intentEventId);
    const scoreRow = await db.queryRow<{ score: number | null }>`
      SELECT score FROM intent_scores WHERE intent_event_id = ${intentEventId}
    `;
    if (scoreRow?.score !== null && scoreRow?.score !== undefined) {
      await upsertAnonymousSubjectScore(
        anonymousId,
        Number(scoreRow.score),
        occurredAt,
        eventType,
        url,
        metadata
      );
    }
  } catch (error) {
    console.warn("[track] Failed to score intent event.", {
      intent_event_id: intentEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleTrack(payload: TrackRequest): Promise<TrackResponse> {
  // Generate request_id for correlation
  const request_id = randomUUID();

  if (!isDbEnabled()) {
    console.info("[track] DB disabled via ENABLE_DB flag.", { request_id });
    return {
      ok: true,
      stored: false,
      reason: "db_disabled",
      request_id,
    };
  }

  try {
    // Validate required fields
    const event = requireNonEmptyString(payload.event, "event");
    let sessionId = payload.session_id;
    if (!sessionId || !isValidUUID(sessionId)) {
      sessionId = randomUUID();
      console.info("[track] Generated new session_id", {
        request_id,
        generated_session_id: sessionId,
      });
    }

    let anonymousId = payload.anonymous_id;
    if (!anonymousId || !isValidUUID(anonymousId)) {
      anonymousId = sessionId;
    }

    const eventId = parseOptionalString(payload.event_id);
    if (eventId && !isValidUUID(eventId)) {
      throw APIError.invalidArgument("event_id must be a valid UUID when provided");
    }

    const url = parseOptionalString(payload.url) ?? "";
    const referrer = parseOptionalString(payload.referrer);
    const occurredAt = parseIsoTimestamp(payload.timestamp) ?? new Date();
    const metadata = parseMetadata(payload.metadata);
    const eventValue = parseOptionalNumber(payload.value);

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
    storedMetadata.session_id = sessionId;
    if (payload.session_id && payload.session_id !== sessionId) {
      storedMetadata.original_session_id = payload.session_id;
    }
    if (payload.anonymous_id && payload.anonymous_id !== anonymousId) {
      storedMetadata.original_anonymous_id = payload.anonymous_id;
    }
    storedMetadata.url = url;
    if (referrer) {
      storedMetadata.referrer = referrer;
    }
    const metadataPayload =
      Object.keys(storedMetadata).length > 0 ? storedMetadata : {};

    let stored = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    const activePool = getPool();
    if (!activePool) {
      errorCode = "db_unavailable";
      errorMessage = "Database unavailable";
      console.error("[track] Database unavailable; skipping persistence.", {
        request_id,
        error_code: errorCode,
      });
      return {
        ok: true,
        stored,
        reason: "db_error",
        error_code: errorCode,
        error_message: errorMessage,
        request_id,
      };
    }

    try {
      await ensureTrackingTables(activePool);

      const existingSession = await activePool.query(
        `SELECT 1 FROM sessions WHERE session_id = $1`,
        [sessionId]
      );
      const isNewSession = existingSession.rowCount === 0;
      let isReturnVisit = false;
      if (isNewSession) {
        const recentSession = await activePool.query(
          `
            SELECT 1
            FROM sessions
            WHERE anonymous_id = $1
              AND session_id <> $2
              AND last_seen_at >= now() - interval '30 days'
            LIMIT 1
          `,
          [anonymousId, sessionId]
        );
        isReturnVisit = (recentSession.rowCount ?? 0) > 0;
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
          occurredAt.toISOString(),
          eventValue ?? null,
          JSON.stringify(metadataPayload),
        ]
      );

      if (shouldCreateIntentEvent(event, eventValue)) {
        const intentEventId = await insertIntentEvent(activePool, {
          eventType: event,
          eventSource: "website",
          eventValue,
          anonymousId,
          occurredAt: occurredAt.toISOString(),
          metadata: metadataPayload,
          dedupeKey: eventId ?? null,
        });
        if (intentEventId) {
          await scoreAndUpdateSubject(
            intentEventId,
            anonymousId,
            occurredAt.toISOString(),
            event,
            url,
            metadataPayload
          );
        }
      }

      if (shouldDerivePricingView(event, url)) {
        const pricingEventId = await insertIntentEvent(activePool, {
          eventType: "pricing_view",
          eventSource: "website",
          eventValue: null,
          anonymousId,
          occurredAt: occurredAt.toISOString(),
          metadata: {
            ...metadataPayload,
            derived: true,
          },
        });
        if (pricingEventId) {
          await scoreAndUpdateSubject(
            pricingEventId,
            anonymousId,
            occurredAt.toISOString(),
            "pricing_view",
            url,
            {
              ...metadataPayload,
              derived: true,
            }
          );
        }
      }

      if (isReturnVisit) {
        const dedupeKey = `return_visit:${sessionId}`;
        const existingReturnVisit = await activePool.query(
          `
            SELECT 1
            FROM intent_events
            WHERE dedupe_key = $1
            LIMIT 1
          `,
          [dedupeKey]
        );
        if (existingReturnVisit.rowCount === 0) {
          const returnVisitId = await insertIntentEvent(activePool, {
            eventType: "return_visit",
            eventSource: "website",
            eventValue: null,
            anonymousId,
            occurredAt: occurredAt.toISOString(),
            metadata: {
              ...metadataPayload,
              derived: true,
            },
            dedupeKey,
          });
          if (returnVisitId) {
            await scoreAndUpdateSubject(
              returnVisitId,
              anonymousId,
              occurredAt.toISOString(),
              "return_visit",
              url,
              {
                ...metadataPayload,
                derived: true,
              }
            );
          }
        }
      }

      stored = true;
    } catch (error) {
      // DB errors are non-fatal - log but don't fail the request
      bootstrapPromise = null;
      errorCode = getDbErrorCode(error);
      errorMessage =
        error instanceof Error ? error.message : "Database query failed";
      logDbError(
        "[track] Failed to record intent event (non-fatal).",
        request_id,
        errorCode,
        error
      );
    }

    return {
      ok: true,
      stored,
      reason: stored ? undefined : "db_error",
      error_code: stored ? undefined : errorCode ?? "db_query_failed",
      error_message: stored ? undefined : errorMessage ?? "Database query failed",
      request_id,
    };
  } catch (error) {
    // Handle validation errors (400)
    if (error instanceof APIError && error.code === "invalid_argument") {
      throw error;
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

    return {
      ok: true,
      stored: false,
      reason: "db_error",
      error_message: fallbackError.message,
      request_id,
    };
  }
}

async function serveTrack(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const payload = await parseJsonBody<TrackRequest>(req);
    const response = await handleTrack(payload);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(response));
  } catch (error) {
    if (error instanceof APIError && error.code === "invalid_argument") {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ code: error.code, message: error.message }));
      return;
    }

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ code: "internal", message: "Internal Server Error" }));
  }
}

export const track = api.raw(
  { expose: true, method: "POST", path: "/track" },
  serveTrack
);

export const trackOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/track" },
  async (req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = 204;
    res.end();
  }
);


export const trackGet = api<EmptyRequest, InfoResponse>(
  { expose: true, method: "GET", path: "/track" },
  async () => ({ message: "use POST /track" })
);

export const trackV1 = api.raw(
  { expose: true, method: "POST", path: "/api/v1/track" },
  serveTrack
);

export const trackV1Options = api.raw(
  { expose: true, method: "OPTIONS", path: "/api/v1/track" },
  async (req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = 204;
    res.end();
  }
);
