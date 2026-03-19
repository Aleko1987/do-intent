import { api, APIError } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";

interface EmptyRequest {
  dummy?: string;
}
import { getAuthData } from "~encore/auth";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { autoScoreEvent } from "./auto_score";
import { calculateIpRepeatBoost } from "./ip_boost";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import {
  applyCorsHeadersWithOptions,
  parseJsonBody,
} from "../internal/cors";
import { buildIpContext } from "../internal/client_ip";
import { readLeadScoringConfig } from "../marketing/scoring_config";

const WEBSITE_ALLOWED_ORIGINS = [
  "https://earthcurebiodiesel.com",
  "https://www.earthcurebiodiesel.com",
] as const;

function applyWebsiteCors(req: IncomingMessage, res: ServerResponse): void {
  applyCorsHeadersWithOptions(req, res, {
    allowedOrigins: WEBSITE_ALLOWED_ORIGINS,
    allowAnyOriginFallback: false,
  });
}

interface TrackRequest {
  event?: string;
  event_id?: string;
  session_id?: string;
  anonymous_id?: string;
  url?: string;
  referrer?: string;
  timestamp?: string;
  value?: number;
  metadata?: unknown;
  ip_raw?: string | null;
  ip_fingerprint?: string | null;
}

interface TrackSuccessResponse {
  ok: true;
}

interface TrackErrorResponse {
  ok: false;
  code: "internal";
  message: string;
  corr: string;
}

interface HandleTrackResult {
  ok: boolean;
  request_id: string;
  code?: string;
  message?: string;
}

interface InfoResponse {
  ok?: true;
  message: string;
}

interface FixDbResponse {
  success: boolean;
  message?: string;
  error?: string;
  leads_found?: number;
  leads?: Array<{
    id: string;
    anonymous_id: string | null;
    owner_user_id: string | null;
    created_at: string;
  }>;
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
            ip_raw TEXT NULL,
            ip_fingerprint TEXT NULL,
            occurred_at TIMESTAMPTZ NOT NULL,
            received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb
          );
        `)
      )
      .then(() =>
        activePool.query(`
          ALTER TABLE IF EXISTS events
          ADD COLUMN IF NOT EXISTS ip_raw TEXT,
          ADD COLUMN IF NOT EXISTS ip_fingerprint TEXT
        `)
      )
      .then(() =>
        activePool.query(`
          ALTER TABLE IF EXISTS intent_events
          ADD COLUMN IF NOT EXISTS ip_raw TEXT,
          ADD COLUMN IF NOT EXISTS ip_fingerprint TEXT
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
      .then(() => ensureMarketingLeadColumns(activePool))
      .then(() => undefined);
  }

  await bootstrapPromise;
}

async function ensureMarketingLeadColumns(activePool: Pool): Promise<void> {
  try {
    const checkCol = await activePool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'marketing_leads'
        AND column_name = 'anonymous_id'
    `);

    if (checkCol.rowCount === 0) {
      console.info("[DB Patch] Adding anonymous_id and clerk_id to marketing_leads...");
      await activePool.query(`
        ALTER TABLE marketing_leads
        ADD COLUMN IF NOT EXISTS anonymous_id TEXT,
        ADD COLUMN IF NOT EXISTS clerk_id TEXT
      `);
      console.info("[DB Patch] Columns added successfully.");
    }

    await activePool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_anonymous_id
      ON marketing_leads(anonymous_id)
      WHERE anonymous_id IS NOT NULL
    `);

    await activePool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_clerk_id
      ON marketing_leads(clerk_id)
      WHERE clerk_id IS NOT NULL
    `);
  } catch (err) {
    console.error(
      "[DB Patch] Failed to patch marketing_leads schema (non-fatal):",
      err
    );
  }
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
const TRACKING_OWNER_USER_ID_FALLBACK = "user_39kcwJnyCHbVS0fuYG6a5fJsD2O";

function resolveTrackingOwnerUserId(): string {
  const configuredOwner = process.env.WEBSITE_OWNER_USER_ID?.trim();
  if (configuredOwner && configuredOwner.length > 0) {
    return configuredOwner;
  }
  return TRACKING_OWNER_USER_ID_FALLBACK;
}

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

async function applyIpFingerprintBoost(
  params: {
    ipRaw: string | null;
    ipFingerprint: string | null;
    anonymousId: string;
    occurredAt: string;
    eventType: string;
    url: string;
    metadata: JsonObject;
  }
): Promise<number> {
  if (!params.ipFingerprint) {
    return 0;
  }

  try {
    const config = await readLeadScoringConfig();
    const stateRow = await db.rawQueryRow<{
      prior_total_events: number;
      new_total_events: number;
    }>(
      `
        WITH existing AS (
          SELECT total_events
          FROM intent_ip_fingerprint_scores
          WHERE ip_fingerprint = $1
        ),
        upserted AS (
          INSERT INTO intent_ip_fingerprint_scores (
            ip_fingerprint,
            ip_raw,
            total_events,
            boost_score_total,
            last_seen_at,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, 1, 0, $3::timestamptz, now(), now()
          )
          ON CONFLICT (ip_fingerprint) DO UPDATE
          SET
            ip_raw = COALESCE(EXCLUDED.ip_raw, intent_ip_fingerprint_scores.ip_raw),
            total_events = intent_ip_fingerprint_scores.total_events + 1,
            last_seen_at = GREATEST(intent_ip_fingerprint_scores.last_seen_at, EXCLUDED.last_seen_at),
            updated_at = now()
          RETURNING total_events
        )
        SELECT
          COALESCE((SELECT total_events FROM existing), 0)::integer AS prior_total_events,
          (SELECT total_events FROM upserted)::integer AS new_total_events
      `,
      params.ipFingerprint,
      params.ipRaw,
      params.occurredAt
    );

    const priorTotalEvents = stateRow?.prior_total_events ?? 0;
    const boostToApply = calculateIpRepeatBoost(
      priorTotalEvents,
      config.ip_boost_enabled,
      config.ip_repeat_boost_points
    );

    if (boostToApply > 0) {
      await upsertAnonymousSubjectScore(
        params.anonymousId,
        boostToApply,
        params.occurredAt,
        params.eventType,
        params.url,
        {
          ...params.metadata,
          ip_boost_applied: true,
          ip_fingerprint: params.ipFingerprint,
          ip_repeat_boost_points: boostToApply,
        }
      );

      await db.rawExec(
        `
          UPDATE intent_ip_fingerprint_scores
          SET boost_score_total = boost_score_total + $2,
              updated_at = now()
          WHERE ip_fingerprint = $1
        `,
        params.ipFingerprint,
        boostToApply
      );
    }

    return boostToApply;
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "42P01") {
      console.warn("[track] ip fingerprint table missing; skipping IP boost");
      return 0;
    }
    throw error;
  }
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
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as JsonObject;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return { raw_metadata: raw };
    }
    return { raw_metadata: raw };
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as JsonObject) };
  }
  return { raw_metadata: String(raw) };
}

const DB_CALL_TIMEOUT_MS = 2500;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("db_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function insertIntentEvent(
  activePool: Pool,
  params: {
    leadId: string | null;
    eventType: string;
    eventSource: string;
    eventValue: number | null;
    anonymousId: string;
    occurredAt: string;
    metadata: JsonObject;
    dedupeKey?: string | null;
    ipRaw?: string | null;
    ipFingerprint?: string | null;
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
        ip_raw,
        ip_fingerprint,
        metadata,
        occurred_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      ON CONFLICT (event_source, dedupe_key)
        WHERE dedupe_key IS NOT NULL
        DO NOTHING
      RETURNING id
    `,
    [
      params.leadId,
      params.anonymousId,
      params.eventType,
      params.eventSource,
      normalizedValue,
      params.dedupeKey ?? null,
      params.ipRaw ?? null,
      params.ipFingerprint ?? null,
      JSON.stringify(params.metadata),
      params.occurredAt,
    ]
  );

  return result.rows[0]?.id ?? null;
}

async function upsertLead(
  activePool: Pool,
  params: {
    anonymousId: string;
    clerkUserId: string | null;
    requestId: string;
  }
): Promise<string> {
  try {
    const ownerUserId = resolveTrackingOwnerUserId();
    const existing = await activePool.query(
      `SELECT id, owner_user_id FROM marketing_leads WHERE anonymous_id = $1 LIMIT 1`,
      [params.anonymousId]
    );

    let leadId = existing.rows[0]?.id;

    if (leadId) {
      const existingOwnerUserId = existing.rows[0]?.owner_user_id as string | null | undefined;
      if (existingOwnerUserId !== ownerUserId || params.clerkUserId) {
        const updated = await activePool.query(
          `
            UPDATE marketing_leads
            SET
              owner_user_id = $2,
              clerk_id = COALESCE(clerk_id, $3),
              updated_at = now()
            WHERE id = $1
            RETURNING id
          `,
          [leadId, ownerUserId, params.clerkUserId]
        );
        leadId = updated.rows[0]?.id ?? leadId;
      }
    }

    if (!leadId) {
      const insertResult = await activePool.query(
        `
          INSERT INTO marketing_leads (
            anonymous_id,
            clerk_id,
            owner_user_id
          ) VALUES ($1, $2, $3)
          RETURNING id
        `,
        [params.anonymousId, params.clerkUserId, ownerUserId]
      );

      leadId = insertResult.rows[0]?.id;
    }

    if (!leadId) {
      throw new Error("Failed to create marketing lead");
    }

    return leadId;
  } catch (err) {
    console.error("[track] Failed to upsert marketing_lead", {
      request_id: params.requestId,
      error: err instanceof Error ? err.message : String(err),
      code: err && typeof err === "object" && "code" in err ? (err as any).code : undefined,
      column:
        err && typeof err === "object" && "column" in err
          ? (err as any).column
          : undefined,
      detail:
        err && typeof err === "object" && "detail" in err
          ? (err as any).detail
          : undefined,
      hint: err && typeof err === "object" && "hint" in err ? (err as any).hint : undefined,
    });
    throw err;
  }
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

async function handleTrack(payload: TrackRequest): Promise<HandleTrackResult> {
  // Generate request_id for correlation
  const request_id = randomUUID();

  if (!isDbEnabled()) {
    console.info("[track] DB disabled via ENABLE_DB flag.", { request_id });
    return {
      ok: true,
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
    const ipRaw = parseOptionalString(payload.ip_raw ?? null);
    const ipFingerprint = parseOptionalString(payload.ip_fingerprint ?? null);
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
    if (ipRaw) {
      storedMetadata.ip_raw = ipRaw;
    }
    if (ipFingerprint) {
      storedMetadata.ip_fingerprint = ipFingerprint;
    }
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
        ok: false,
        code: errorCode,
        message: errorMessage,
        request_id,
      };
    }

    try {
      await withTimeout(
        (async () => {
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
            ip,
            last_seen_at
          ) VALUES ($1, $2, $3, now())
          ON CONFLICT (session_id) DO UPDATE
          SET anonymous_id = EXCLUDED.anonymous_id,
              ip = COALESCE(EXCLUDED.ip, sessions.ip),
              last_seen_at = now()
        `,
            [sessionId, anonymousId, ipRaw]
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
            ip_raw,
            ip_fingerprint,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
            [
              event,
              sessionId,
              anonymousId,
              url,
              referrer,
              occurredAt.toISOString(),
              eventValue ?? null,
              ipRaw,
              ipFingerprint,
              JSON.stringify(metadataPayload),
            ]
          );

          const leadId = await upsertLead(activePool, {
            anonymousId,
            clerkUserId,
            requestId: request_id,
          });

          if (shouldCreateIntentEvent(event, eventValue)) {
            const intentEventId = await insertIntentEvent(activePool, {
          leadId,
          eventType: event,
          eventSource: "website",
          eventValue,
          anonymousId,
          occurredAt: occurredAt.toISOString(),
          metadata: metadataPayload,
          dedupeKey: eventId ?? null,
          ipRaw,
          ipFingerprint,
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

              const ipBoostApplied = await applyIpFingerprintBoost({
                ipRaw,
                ipFingerprint,
                anonymousId,
                occurredAt: occurredAt.toISOString(),
                eventType: event,
                url,
                metadata: metadataPayload,
              });
              if (ipBoostApplied > 0) {
                console.info("[track] applied ip repeat-visit boost", {
                  request_id,
                  anonymous_id: anonymousId,
                  ip_fingerprint: ipFingerprint,
                  boost_points: ipBoostApplied,
                });
              }
            }
          }

          if (shouldDerivePricingView(event, url)) {
            const pricingEventId = await insertIntentEvent(activePool, {
          leadId,
          eventType: "pricing_view",
          eventSource: "website",
          eventValue: null,
          anonymousId,
          occurredAt: occurredAt.toISOString(),
          metadata: {
            ...metadataPayload,
            derived: true,
          },
          ipRaw,
          ipFingerprint,
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
            leadId,
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
            ipRaw,
            ipFingerprint,
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
        })(),
        DB_CALL_TIMEOUT_MS
      );

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
      ok: stored,
      code: stored ? undefined : errorCode ?? "db_query_failed",
      message: stored ? undefined : errorMessage ?? "Database query failed",
      request_id,
    };
  } catch (error) {
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
      ok: false,
      code: "internal",
      message: fallbackError.message,
      request_id,
    };
  }
}

async function serveTrack(req: IncomingMessage, res: ServerResponse): Promise<void> {
  applyWebsiteCors(req, res);
  try {
    const payload = await parseJsonBody<TrackRequest>(req);
    const { ipRaw, ipFingerprint } = buildIpContext(req);
    const requestPayload: TrackRequest = {
      ...payload,
      ip_raw: payload.ip_raw ?? ipRaw,
      ip_fingerprint: payload.ip_fingerprint ?? ipFingerprint,
    };
    const response = await handleTrack(requestPayload);
    res.statusCode = response.ok ? 200 : 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (response.ok) {
      const successResponse: TrackSuccessResponse = { ok: true };
      res.end(JSON.stringify(successResponse));
      return;
    }

    const errorResponse: TrackErrorResponse = {
      ok: false,
      code: "internal",
      message: response.message ?? "Internal Server Error",
      corr: response.request_id,
    };
    res.end(JSON.stringify(errorResponse));
  } catch (error) {
    const corr = randomUUID();
    const message =
      error instanceof APIError && error.code === "invalid_argument"
        ? error.message
        : error instanceof Error
          ? error.message
          : "Internal Server Error";
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({ ok: false, code: "internal", message, corr } satisfies TrackErrorResponse)
    );
  }
}

// Frontend sends POST requests to this route.
export const track = api.raw(
  {
    expose: true,
    method: "POST",
    path: "/track",
  },
  serveTrack
);

export const trackOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/track" },
  async (req: IncomingMessage, res: ServerResponse) => {
    applyWebsiteCors(req, res);
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
    applyWebsiteCors(req, res);
    res.statusCode = 204;
    res.end();
  }
);

// Explicit alias for clients that call service-scoped paths directly.
export const trackServiceScoped = api.raw(
  { expose: true, method: "POST", path: "/intent_scorer/track" },
  serveTrack
);

export const trackServiceScopedOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/intent_scorer/track" },
  async (req: IncomingMessage, res: ServerResponse) => {
    applyWebsiteCors(req, res);
    res.statusCode = 204;
    res.end();
  }
);

export const fixDb = api<EmptyRequest, FixDbResponse>(
  { method: "GET", path: "/intent_scorer/fix-db", expose: true },
  async () => {
    try {
      const pool = getPool();
      if (!pool) {
        return {
          success: false,
          error: "Database unavailable",
        };
      }

      // 1. Ensure columns exist (safe to run again)
      await pool.query(`
        ALTER TABLE marketing_leads
        ADD COLUMN IF NOT EXISTS anonymous_id TEXT,
        ADD COLUMN IF NOT EXISTS clerk_id TEXT
      `);

      // 2. Ensure index exists
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_anonymous_id
        ON marketing_leads(anonymous_id)
        WHERE anonymous_id IS NOT NULL
      `);

      // 3. DEBUG: Fetch all leads to see if they exist
      const result = await pool.query(`
        SELECT id, anonymous_id, owner_user_id, created_at
        FROM marketing_leads
        ORDER BY created_at DESC
        LIMIT 5
      `);

      return {
        success: true,
        message: "Schema patched",
        leads_found: result.rows.length,
        leads: result.rows,
      };
    } catch (err) {
      console.error("[fix-db] Failed", err);
      return {
        success: false,
        error: String(err),
      };
    }
  }
);
