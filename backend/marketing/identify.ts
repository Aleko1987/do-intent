import { api, APIError } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db } from "../db/db";
import { resolveIngestApiKey } from "../internal/env_secrets";
import {
  applyCorsHeadersWithOptions,
  parseJsonBody,
} from "../internal/cors";
import { applyCorrelationId } from "../internal/correlation";
import { buildIpContext } from "../internal/client_ip";
import { resolveWebsiteOwnerUserId } from "../internal/owner_user";
import type { MarketingLead } from "./types";
import { readLeadScoringConfig } from "./scoring_config";
import { computeCarryForwardScore } from "./carry_forward";

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

function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_INGEST_ORIGINS;
  if (!origins) {
    return [];
  }
  return origins.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

interface IdentifyPayload {
  anonymous_id?: string;
  session_id?: string;
  email?: string;
  company_name?: string;
  contact_name?: string;
}

interface IdentifyRequest extends IdentifyPayload {
  "x-do-intent-key"?: string;
  origin?: string;
  referer?: string;
  ip_raw?: string | null;
  ip_fingerprint?: string | null;
}

interface IdentifyResponse {
  lead_id: string;
  lead_created: boolean;
}

interface PgError extends Error {
  code?: string;
}

interface AnonymousLeadCandidate {
  id: string;
  anonymous_id: string | null;
  intent_score: number;
}

type IdentifyPersistenceMode =
  | "update_existing_email_lead"
  | "convert_anonymous_lead_in_place"
  | "insert_new_lead";

export function resolveIdentifyPersistenceMode(params: {
  emailProvided: boolean;
  hasExistingLead: boolean;
  hasExistingAnonymousLead: boolean;
}): IdentifyPersistenceMode {
  if (params.hasExistingLead) {
    return "update_existing_email_lead";
  }

  if (params.emailProvided && params.hasExistingAnonymousLead) {
    return "convert_anonymous_lead_in_place";
  }

  return "insert_new_lead";
}

export function computeCumulativeIntentScore(baseScore: number, donorScores: number[]): number {
  const normalizedBase = Math.max(0, Math.round(baseScore ?? 0));
  return donorScores.reduce(
    (acc, score) => computeCarryForwardScore(acc, score),
    normalizedBase
  );
}

function hasNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function stageForScore(
  score: number,
  thresholds: {
    m2_min: number;
    m3_min: number;
    m4_min: number;
    m5_min: number;
  }
): string {
  if (score >= thresholds.m5_min) return "M5";
  if (score >= thresholds.m4_min) return "M4";
  if (score >= thresholds.m3_min) return "M3";
  if (score >= thresholds.m2_min) return "M2";
  return "M1";
}

async function carryForwardAnonymousSubjectScore(params: {
  lead: MarketingLead;
  anonymousId: string | null;
  ownerUserId: string;
  corr?: string;
}): Promise<MarketingLead> {
  try {
    if (!params.anonymousId || !isUuid(params.anonymousId)) {
      return params.lead;
    }

    const subjectScoreRow = await db.rawQueryRow<{ total_score: number }>(
      `
        SELECT total_score
        FROM intent_subject_scores
        WHERE subject_type = 'anonymous'
          AND subject_id = $1::uuid
        LIMIT 1
      `,
      params.anonymousId
    );

    const anonymousScore = Math.max(0, Math.round(subjectScoreRow?.total_score ?? 0));
    if (anonymousScore <= 0) {
      return params.lead;
    }

    const nextScore = computeCarryForwardScore(params.lead.intent_score ?? 0, anonymousScore);
    const scoringConfig = await readLeadScoringConfig();
    const nextStage = stageForScore(nextScore, scoringConfig);

    const updatedLead = await db.queryRow<MarketingLead>`
      UPDATE marketing_leads
      SET
        intent_score = ${nextScore},
        marketing_stage = ${nextStage},
        last_signal_at = now(),
        updated_at = now()
      WHERE id = ${params.lead.id}
        AND owner_user_id = ${params.ownerUserId}
      RETURNING *
    `;

    if (!updatedLead) {
      return params.lead;
    }

    await db.rawExec(
      `
        DELETE FROM intent_subject_scores
        WHERE subject_type = 'anonymous'
          AND subject_id = $1::uuid
      `,
      params.anonymousId
    );

    console.info("[identify] carried anonymous subject score into lead", {
      corr: params.corr,
      lead_id: updatedLead.id,
      owner_user_id: params.ownerUserId,
      anonymous_id: params.anonymousId,
      carried_score: anonymousScore,
      resulting_score: nextScore,
    });

    return updatedLead;
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === "42P01") {
      console.warn("[identify] subject score table missing, skipping carry-forward");
      return params.lead;
    }
    console.warn("[identify] failed to carry-forward anonymous subject score", {
      corr: params.corr,
      lead_id: params.lead.id,
      anonymous_id: params.anonymousId,
      code: pgError.code,
      message: pgError.message,
    });
    return params.lead;
  }
}

async function alignLeadStageWithCurrentScore(params: {
  lead: MarketingLead;
  ownerUserId: string;
  corr?: string;
}): Promise<MarketingLead> {
  const score = Math.max(0, Math.round(params.lead.intent_score ?? 0));
  const cfg = await readLeadScoringConfig();
  const resolvedStage = stageForScore(score, cfg);
  if (params.lead.marketing_stage === resolvedStage) {
    return params.lead;
  }

  const updated = await db.queryRow<MarketingLead>`
    UPDATE marketing_leads
    SET marketing_stage = ${resolvedStage}, updated_at = now()
    WHERE id = ${params.lead.id}
      AND owner_user_id = ${params.ownerUserId}
    RETURNING *
  `;

  if (!updated) {
    return params.lead;
  }

  console.info("[identify] aligned lead stage with score", {
    corr: params.corr,
    lead_id: updated.id,
    owner_user_id: params.ownerUserId,
    score,
    stage: resolvedStage,
  });
  return updated;
}

type AuthHeaderName = "x-do-intent-key" | "x-ingest-api-key" | "authorization";

function hasValidApiKey(headerKey: string | undefined): boolean {
  const expectedKey = process.env.INGEST_API_KEY?.trim() || resolveIngestApiKey();

  if (!headerKey || !expectedKey) {
    return false;
  }

  return headerKey.trim() === expectedKey;
}

function checkOrigin(origin: string | undefined, referer: string | undefined): void {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) {
    return;
  }

  let hostname: string | null = null;
  if (origin && URL.canParse(origin)) {
    const url = new URL(origin);
    hostname = url.hostname;
  }
  if (!hostname && referer && URL.canParse(referer)) {
    const url = new URL(referer);
    hostname = url.hostname;
  }

  if (!hostname) {
    throw APIError.permissionDenied("API key or origin/referer header required");
  }

  const isAllowed = allowedOrigins.some((allowed) => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowed) {
    throw APIError.permissionDenied(`origin ${hostname} not in allowlist`);
  }
}

async function upsertLead(
  req: IdentifyRequest,
  email: string | null,
  corr?: string
): Promise<{ lead: MarketingLead; lead_created: boolean }> {
  const desiredOwnerId = resolveWebsiteOwnerUserId();
  const companyName = req.company_name?.trim() || null;
  const company = companyName;
  const contactName = req.contact_name?.trim() || null;
  const anonymousId = req.anonymous_id?.trim() || null;
  const sessionId = req.session_id?.trim() || null;
  const ipFingerprint = req.ip_fingerprint?.trim() || null;
  const emailProvided = email !== null;
  const contactNameProvided = contactName !== null;
  const companyNameProvided = companyName !== null;

  console.info("[identify] owner context", {
    owner_user_id_used: desiredOwnerId,
    has_email: emailProvided,
    anonymous_id: anonymousId,
  });

  const findExistingLead = emailProvided
    ? db.queryRow<MarketingLead>`
      SELECT *
      FROM marketing_leads
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `
    : db.queryRow<MarketingLead>`
      SELECT *
      FROM marketing_leads
      WHERE owner_user_id = ${desiredOwnerId}
        AND anonymous_id = ${anonymousId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

  const existingLead = await findExistingLead;
  let existingAnonymousLead: MarketingLead | null = null;
  if (emailProvided && anonymousId) {
    existingAnonymousLead = await db.queryRow<MarketingLead>`
      SELECT *
      FROM marketing_leads
      WHERE anonymous_id = ${anonymousId}
      ORDER BY
        CASE
          WHEN owner_user_id = ${desiredOwnerId} THEN 0
          ELSE 1
        END,
        CASE
          WHEN email IS NULL OR btrim(email) = '' THEN 0
          ELSE 1
        END,
        created_at DESC
      LIMIT 1
    `;
  }

  // Fallback: when anonymous_id differs across website/app origins, attempt
  // a conservative IP-fingerprint match to the most recent anonymous lead.
  if (emailProvided && !existingAnonymousLead && ipFingerprint) {
    try {
      const ipCandidates = await db.rawQueryAll<MarketingLead>(
        `
          SELECT ml.*
          FROM marketing_leads ml
          JOIN intent_events ie
            ON ie.anonymous_id = ml.anonymous_id
          WHERE ie.ip_fingerprint = $1
            AND ml.owner_user_id = $2
            AND (ml.email IS NULL OR btrim(ml.email) = '')
            AND ie.occurred_at >= now() - interval '6 hours'
          GROUP BY ml.id
          ORDER BY max(ie.occurred_at) DESC
          LIMIT 10
        `,
        ipFingerprint,
        desiredOwnerId
      );

      if (ipCandidates.length >= 1) {
        const candidate = ipCandidates[0];
        if (!existingLead || candidate.id !== existingLead.id) {
          existingAnonymousLead = candidate;
          console.info("[identify] selected anonymous lead via ip fingerprint fallback", {
            corr,
            owner_user_id: desiredOwnerId,
            ip_fingerprint: ipFingerprint,
            anonymous_lead_id: candidate.id,
          });
        }
      }
    } catch (error) {
      const pgError = error as PgError;
      if (pgError.code !== "42P01" && pgError.code !== "42703") {
        throw error;
      }
      console.warn("[identify] ip fingerprint fallback unavailable", {
        corr,
        code: pgError.code,
      });
    }
  }

  const persistenceMode = resolveIdentifyPersistenceMode({
    emailProvided,
    hasExistingLead: !!existingLead,
    hasExistingAnonymousLead: !!existingAnonymousLead,
  });

  const performPersistence = async (): Promise<{ lead: MarketingLead; lead_created: boolean }> => {
    if (persistenceMode === "update_existing_email_lead" && existingLead) {
      const updatedLead = await db.queryRow<MarketingLead>`
        UPDATE marketing_leads
        SET
          owner_user_id = CASE
            WHEN owner_user_id IS NULL OR owner_user_id <> ${desiredOwnerId} THEN ${desiredOwnerId}
            ELSE owner_user_id
          END,
          email = COALESCE(${email}, email),
          contact_name = COALESCE(${contactName}, contact_name),
          company_name = COALESCE(${companyName}, company_name),
          company = COALESCE(${companyName}, company),
          anonymous_id = COALESCE(${anonymousId}, anonymous_id),
          source_type = COALESCE(source_type, 'website'),
          source = COALESCE(source, 'website'),
          last_signal_at = now(),
          updated_at = now()
        WHERE id = ${existingLead.id}
        RETURNING *
      `;

      if (!updatedLead) {
        throw new Error("Failed to update lead");
      }

      return { lead: updatedLead, lead_created: false };
    }

    if (persistenceMode === "convert_anonymous_lead_in_place" && existingAnonymousLead) {
      const convertedLead = await db.queryRow<MarketingLead>`
        UPDATE marketing_leads
        SET
          owner_user_id = CASE
            WHEN owner_user_id IS NULL OR owner_user_id <> ${desiredOwnerId} THEN ${desiredOwnerId}
            ELSE owner_user_id
          END,
          email = COALESCE(${email}, email),
          contact_name = COALESCE(${contactName}, contact_name),
          company_name = COALESCE(${companyName}, company_name),
          company = COALESCE(${companyName}, company),
          anonymous_id = COALESCE(anonymous_id, ${anonymousId}),
          source_type = COALESCE(source_type, 'website'),
          source = COALESCE(source, 'website'),
          last_signal_at = now(),
          updated_at = now()
        WHERE id = ${existingAnonymousLead.id}
        RETURNING *
      `;

      if (!convertedLead) {
        throw new Error("Failed to convert anonymous lead in place");
      }

      console.info("[identify] converted anonymous lead in place", {
        corr,
        owner_user_id: desiredOwnerId,
        anonymous_lead_id: existingAnonymousLead.id,
      });

      return { lead: convertedLead, lead_created: false };
    }

    let insertedLead: MarketingLead | null = null;
    try {
      insertedLead = await db.queryRow<MarketingLead>`
        INSERT INTO marketing_leads (
          company,
          company_name,
          contact_name,
          email,
          anonymous_id,
          source_type,
          source,
          owner_user_id,
          marketing_stage,
          intent_score,
          last_signal_at,
          updated_at,
          created_at
        ) VALUES (
          ${company},
          ${companyName},
          ${contactName},
          ${email},
          ${anonymousId},
          'website',
          'website',
          ${desiredOwnerId},
          'M1',
          0,
          now(),
          now(),
          now()
        )
        RETURNING *
      `;
    } catch (error) {
      const pgError = error as PgError;
      if (!emailProvided || pgError.code !== "23505") {
        throw error;
      }

      const duplicateLead = await db.queryRow<MarketingLead>`
        SELECT *
        FROM marketing_leads
        WHERE lower(email) = lower(${email})
        LIMIT 1
      `;

      if (!duplicateLead) {
        throw error;
      }

      insertedLead = await db.queryRow<MarketingLead>`
        UPDATE marketing_leads
        SET
          owner_user_id = CASE
            WHEN owner_user_id IS NULL OR owner_user_id <> ${desiredOwnerId} THEN ${desiredOwnerId}
            ELSE owner_user_id
          END,
          email = COALESCE(${email}, email),
          contact_name = COALESCE(${contactName}, contact_name),
          company_name = COALESCE(${companyName}, company_name),
          company = COALESCE(${companyName}, company),
          anonymous_id = COALESCE(${anonymousId}, anonymous_id),
          source_type = COALESCE(source_type, 'website'),
          source = COALESCE(source, 'website'),
          last_signal_at = now(),
          updated_at = now()
        WHERE id = ${duplicateLead.id}
        RETURNING *
      `;

      if (!insertedLead) {
        throw new Error("Failed to update lead after duplicate email insert");
      }

      return { lead: insertedLead, lead_created: false };
    }

    if (!insertedLead) {
      throw new Error("Failed to insert lead");
    }

    return { lead: insertedLead, lead_created: true };
  };

  const result = await performPersistence();

  let persistedLead = result.lead;
  if (emailProvided && existingAnonymousLead && existingAnonymousLead.id !== result.lead.id) {
    const mergedScore = computeCumulativeIntentScore(result.lead.intent_score ?? 0, [
      existingAnonymousLead.intent_score ?? 0,
    ]);
    let mergedLead: MarketingLead | null = null;
    try {
      mergedLead = await db.queryRow<MarketingLead>`
        UPDATE marketing_leads
        SET
          company = COALESCE(marketing_leads.company, ${existingAnonymousLead.company ?? null}),
          company_name = COALESCE(marketing_leads.company_name, ${existingAnonymousLead.company_name ?? null}),
          contact_name = COALESCE(marketing_leads.contact_name, ${existingAnonymousLead.contact_name ?? null}),
          anonymous_id = COALESCE(marketing_leads.anonymous_id, ${existingAnonymousLead.anonymous_id ?? null}),
          source_type = COALESCE(marketing_leads.source_type, ${existingAnonymousLead.source_type ?? null}),
          marketing_stage = COALESCE(marketing_leads.marketing_stage, ${existingAnonymousLead.marketing_stage ?? null}),
          intent_score = ${mergedScore},
          last_signal_at = now(),
          updated_at = now()
        WHERE id = ${result.lead.id}
        RETURNING *
      `;
    } catch (error) {
      const pgError = error as PgError;
      if (pgError.code !== "42703") {
        throw error;
      }

      mergedLead = await db.queryRow<MarketingLead>`
        UPDATE marketing_leads
        SET
          anonymous_id = COALESCE(marketing_leads.anonymous_id, ${existingAnonymousLead.anonymous_id ?? null}),
          intent_score = ${mergedScore},
          last_signal_at = now(),
          updated_at = now()
        WHERE id = ${result.lead.id}
        RETURNING *
      `;
    }

    if (!mergedLead) {
      throw new Error("Failed to merge anonymous lead into email lead");
    }

    persistedLead = mergedLead;

    await cleanupMergedAnonymousLead(existingAnonymousLead.id, result.lead.id);
  }

  persistedLead = await absorbAdditionalAnonymousLeads({
    lead: persistedLead,
    ownerUserId: desiredOwnerId,
    ipFingerprint,
    sessionId,
    anonymousId,
    corr,
  });

  console.info("[identify] lead persistence", {
    email_provided: emailProvided,
    contact_name_provided: contactNameProvided,
    company_name_provided: companyNameProvided,
    has_email: !!persistedLead.email,
    has_contact_name: !!persistedLead.contact_name,
    has_company: !!persistedLead.company,
    has_company_name: !!persistedLead.company_name,
  });

  const leadWithCarryForward = await carryForwardAnonymousSubjectScore({
    lead: persistedLead,
    anonymousId,
    ownerUserId: desiredOwnerId,
    corr,
  });

  const alignedLead = await alignLeadStageWithCurrentScore({
    lead: leadWithCarryForward,
    ownerUserId: desiredOwnerId,
    corr,
  });

  return {
    lead: alignedLead,
    lead_created: result.lead_created,
  };
}

async function cleanupMergedAnonymousLead(
  anonymousLeadId: string,
  destinationLeadId: string
): Promise<void> {
  let cleanedUpAnonLead = false;
  let usedDeletedAt = false;
  let usedMergedToId = false;
  let usedHardDelete = false;
  try {
    await db.exec`
      UPDATE marketing_leads
      SET deleted_at = now(), last_signal_at = now(), updated_at = now()
      WHERE id = ${anonymousLeadId}
    `;
    cleanedUpAnonLead = true;
    usedDeletedAt = true;
  } catch (error) {
    const pgError = error as PgError;
    if (pgError.code !== "42703") {
      throw error;
    }

    try {
      await db.exec`
        UPDATE marketing_leads
        SET merged_to_id = ${destinationLeadId}, last_signal_at = now(), updated_at = now()
        WHERE id = ${anonymousLeadId}
      `;
      cleanedUpAnonLead = true;
      usedMergedToId = true;
    } catch (mergeMarkerError) {
      const mergeMarkerPgError = mergeMarkerError as PgError;
      if (mergeMarkerPgError.code !== "42703") {
        throw mergeMarkerError;
      }

      await db.exec`
        DELETE FROM marketing_leads
        WHERE id = ${anonymousLeadId}
      `;
      cleanedUpAnonLead = true;
      usedHardDelete = true;
    }
  }

  console.info("[identify] merged anonymous lead cleanup", {
    merge_performed: true,
    anon_cleanup_performed: cleanedUpAnonLead,
    anon_cleanup_used_deleted_at: usedDeletedAt,
    anon_cleanup_used_merged_to_id: usedMergedToId,
    anon_cleanup_used_hard_delete: usedHardDelete,
  });
}

async function absorbAdditionalAnonymousLeads(params: {
  lead: MarketingLead;
  ownerUserId: string;
  ipFingerprint: string | null;
  sessionId: string | null;
  anonymousId: string | null;
  corr?: string;
}): Promise<MarketingLead> {
  if (!params.ipFingerprint && !params.sessionId && !params.anonymousId) {
    return params.lead;
  }

  let candidates: AnonymousLeadCandidate[] = [];
  try {
    candidates = await db.rawQueryAll<AnonymousLeadCandidate>(
      `
        SELECT
          ml.id,
          ml.anonymous_id,
          COALESCE(ml.intent_score, 0)::integer AS intent_score
        FROM marketing_leads ml
        LEFT JOIN intent_events ie
          ON ie.anonymous_id = ml.anonymous_id
        WHERE ml.id <> $2
          AND (ml.email IS NULL OR btrim(ml.email) = '')
          AND (
            ($3::text IS NOT NULL AND ie.ip_fingerprint = $3 AND ie.occurred_at >= now() - interval '30 minutes')
            OR ($4::text IS NOT NULL AND ie.metadata ->> 'session_id' = $4 AND ie.occurred_at >= now() - interval '6 hours')
            OR ($5::text IS NOT NULL AND ml.anonymous_id = $5)
            OR (
              $4::text IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM sessions s
                WHERE s.session_id::text = $4
                  AND s.anonymous_id::text = ml.anonymous_id
                  AND s.last_seen_at >= now() - interval '6 hours'
              )
            )
          )
        GROUP BY ml.id
        ORDER BY
          CASE
            WHEN ml.owner_user_id = $1 THEN 0
            ELSE 1
          END,
          max(ie.occurred_at) DESC NULLS LAST,
          max(ml.updated_at) DESC NULLS LAST
        LIMIT 20
      `,
      params.ownerUserId,
      params.lead.id,
      params.ipFingerprint,
      params.sessionId,
      params.anonymousId
    );
  } catch (error) {
    const pgError = error as PgError;
    if (pgError.code !== "42P01" && pgError.code !== "42703") {
      throw error;
    }
    return params.lead;
  }

  if (candidates.length === 0) {
    console.info("[identify] no additional anonymous lead candidates to absorb", {
      corr: params.corr,
      owner_user_id: params.ownerUserId,
      destination_lead_id: params.lead.id,
      anonymous_id: params.anonymousId,
      ip_fingerprint: params.ipFingerprint,
      session_id: params.sessionId,
    });
    return params.lead;
  }

  console.info("[identify] candidate anonymous leads selected for absorption", {
    corr: params.corr,
    owner_user_id: params.ownerUserId,
    destination_lead_id: params.lead.id,
    candidate_count: candidates.length,
    candidate_ids: candidates.map((c) => c.id),
    candidate_anonymous_ids: candidates.map((c) => c.anonymous_id),
    anonymous_id: params.anonymousId,
    ip_fingerprint: params.ipFingerprint,
    session_id: params.sessionId,
  });

  const mergedScore = computeCumulativeIntentScore(
    params.lead.intent_score ?? 0,
    candidates.map((c) => c.intent_score ?? 0)
  );

  const updatedLead = await db.queryRow<MarketingLead>`
    UPDATE marketing_leads
    SET
      intent_score = ${mergedScore},
      last_signal_at = now(),
      updated_at = now()
    WHERE id = ${params.lead.id}
      AND owner_user_id = ${params.ownerUserId}
    RETURNING *
  `;

  if (!updatedLead) {
    return params.lead;
  }

  for (const candidate of candidates) {
    if (candidate.anonymous_id) {
      await db.exec`
        UPDATE intent_events
        SET lead_id = ${updatedLead.id}
        WHERE anonymous_id = ${candidate.anonymous_id}
          AND (lead_id IS NULL OR lead_id = ${candidate.id})
      `;
    }
    await cleanupMergedAnonymousLead(candidate.id, updatedLead.id);
  }

  console.info("[identify] absorbed additional anonymous leads by ip/session context", {
    corr: params.corr,
    owner_user_id: params.ownerUserId,
    destination_lead_id: updatedLead.id,
    absorbed_count: candidates.length,
    anonymous_id: params.anonymousId,
    ip_fingerprint: params.ipFingerprint,
    session_id: params.sessionId,
    merged_score: mergedScore,
  });

  return updatedLead;
}

async function handleIdentify(req: IdentifyRequest, corr?: string): Promise<IdentifyResponse> {
  try {
    console.info("[identify] Request", {
      has_email: hasNonEmptyString(req.email),
      anonymous_id: req.anonymous_id,
      has_contact_name: hasNonEmptyString(req.contact_name),
    });

    const providedApiKey = req["x-do-intent-key"]?.trim();
    const authHeaderNameUsed: AuthHeaderName = "x-do-intent-key";
    if (providedApiKey && hasValidApiKey(providedApiKey)) {
      console.info("[identify] auth check", {
        authHeaderNameUsed,
        authPassed: true,
      });
      // API-key traffic accepted.
    } else if (providedApiKey) {
      console.info("[identify] auth check", {
        authHeaderNameUsed,
        authPassed: false,
      });
      throw APIError.permissionDenied("invalid API key");
    } else {
      console.info("[identify] auth check", {
        authHeaderNameUsed,
        authPassed: false,
      });
      if (!req.origin && !req.referer) {
        throw APIError.permissionDenied("API key or origin/referer header required");
      }
      checkOrigin(req.origin, req.referer);
    }

    if (!req.anonymous_id || typeof req.anonymous_id !== "string") {
      throw APIError.invalidArgument("anonymous_id is required");
    }

    const normalizedEmail = typeof req.email === "string" ? req.email.trim().toLowerCase() : "";
    const email = normalizedEmail.length > 0 ? normalizedEmail : null;

    const upsertResult = await upsertLead(req, email, corr);

    return {
      lead_id: upsertResult.lead.id,
      lead_created: upsertResult.lead_created,
    };
  } catch (error) {
    console.error("[identify] Error", error);
    throw error;
  }
}

function getHeaderValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

async function serveIdentify(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startedAt = Date.now();
  const corr = applyCorrelationId(req, res);
  applyWebsiteCors(req, res);
  let errorCode: string | undefined;

  try {
    const payload = await parseJsonBody<IdentifyPayload>(req);
    const apiKeyHeader = getHeaderValue(req, "x-do-intent-key");
    // Keep this explicit so auth logs always name the key header expected by this endpoint.
    const authHeaderNameUsed: AuthHeaderName = "x-do-intent-key";
    console.info("[identify] start", {
      corr,
      method: req.method,
      path: req.url,
      hasAuthHeader: !!apiKeyHeader,
      authHeaderNameUsed,
      bodyShape: {
        hasEmail: hasNonEmptyString(payload?.email),
        hasAnonymousId: hasNonEmptyString(payload?.anonymous_id),
        hasContactName: hasNonEmptyString(payload?.contact_name),
        hasCompanyName: hasNonEmptyString(payload?.company_name),
        hasLeadId: false,
        hasEventType: false,
      },
    });

    const request: IdentifyRequest = {
      ...payload,
      "x-do-intent-key": apiKeyHeader,
      origin: getHeaderValue(req, "origin"),
      referer: getHeaderValue(req, "referer"),
      ...buildIpContext(req),
    };

    const providedApiKey = request["x-do-intent-key"]?.trim();
    if (providedApiKey && !hasValidApiKey(providedApiKey)) {
      console.info("[identify] auth failed", {
        corr,
        reason: "invalid key",
        headerChecked: "x-do-intent-key",
      });
    }
    if (!providedApiKey && !request.origin && !request.referer) {
      console.info("[identify] auth failed", {
        corr,
        reason: "missing key",
        headerChecked: "x-do-intent-key",
      });
    }

    const missing: string[] = [];
    if (!request.anonymous_id || typeof request.anonymous_id !== "string") {
      missing.push("anonymous_id");
    }
    if (missing.length > 0) {
      console.info("[identify] validation failed", {
        corr,
        missing,
      });
    }

    const response = await handleIdentify(request, corr);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(response));
  } catch (error) {
    if (error instanceof APIError) {
      errorCode = error.code;
      const status = error.code === "invalid_argument" ? 400 :
        error.code === "permission_denied" || error.code === "unauthenticated" ? 401 : 500;
      if (status === 401) {
        console.info("[identify] auth failed", {
          corr,
          reason: error.message.includes("invalid API key") ? "invalid key" : "missing key",
          headerChecked: "x-do-intent-key",
        });
      }
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ code: error.code, message: error.message, error: error.message, corr }));

      if (status >= 500) {
        console.error("[identify] server error", {
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
    console.error("[identify] server error", {
      corr,
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ code: "internal", message: "Internal Server Error", error: "Internal Server Error", corr }));
  } finally {
    console.info("[identify] end", {
      corr,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
    });
  }
}

export const identify = api.raw(
  { expose: true, method: "POST", path: "/marketing/identify" },
  serveIdentify
);

export const identifyOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/marketing/identify" },
  async (req: IncomingMessage, res: ServerResponse) => {
    applyWebsiteCors(req, res);
    res.statusCode = 204;
    res.end();
  }
);
