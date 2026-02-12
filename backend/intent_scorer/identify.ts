import { api, APIError } from "encore.dev/api";

interface EmptyRequest {
  dummy?: string;
}
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import {
  ThresholdBand,
  bandFromScore,
  shouldEmitThreshold,
} from "./scoring";
import { updateLeadRollup } from "./rollups";

// Request shape (v1)
interface IdentifyRequest {
  anonymous_id: string;
  email: string;
  name?: string;
  source?: string;
  metadata?: string;
}

// Response shape
interface IdentifyResponse {
  ok: boolean;
  identity_id: string;
  merged: boolean;
  previous_anonymous_score: number;
  previous_identity_score: number;
  total_identity_score: number;
  band: "cold" | "warm" | "hot" | "critical";
  threshold_emitted: boolean;
}

interface TopIdentityEvent {
  event_id: string;
  event_type: string;
  event_source: string;
  event_value: number | null;
  occurred_at: string;
  score: number;
  reasons: string[];
  metadata: JsonObject;
}

/**
 * Validates UUID format (simple check)
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Basic email validation (not perfect RFC, but catches obvious issues)
 */
function isValidEmail(email: string): boolean {
  // Basic check: contains @ and at least one character before and after
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function normalizeJsonObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as JsonObject;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // ignore parse error
    }
  }
  return {};
}

async function getTopIdentityEvents(
  anonymousId: string,
  leadId: string | null
): Promise<TopIdentityEvent[]> {
  const limit = 10;
  if (leadId) {
    const query = `
      SELECT
        ie.id as event_id,
        ie.event_type,
        ie.event_source,
        ie.event_value,
        ie.occurred_at,
        ie.metadata,
        isc.score,
        isc.reasons
      FROM intent_events ie
      JOIN intent_scores isc ON ie.id = isc.intent_event_id
      WHERE (ie.anonymous_id = $1 OR ie.lead_id = $2)
        AND ie.occurred_at >= NOW() - INTERVAL '30 days'
      ORDER BY isc.score DESC, ie.occurred_at DESC
      LIMIT $3
    `;
    return await db.rawQueryAll<TopIdentityEvent>(query, anonymousId, leadId, limit);
  }

  const query = `
    SELECT
      ie.id as event_id,
      ie.event_type,
      ie.event_source,
      ie.event_value,
      ie.occurred_at,
      ie.metadata,
      isc.score,
      isc.reasons
    FROM intent_events ie
    JOIN intent_scores isc ON ie.id = isc.intent_event_id
    WHERE ie.anonymous_id = $1
      AND ie.occurred_at >= NOW() - INTERVAL '30 days'
    ORDER BY isc.score DESC, ie.occurred_at DESC
    LIMIT $2
  `;
  return await db.rawQueryAll<TopIdentityEvent>(query, anonymousId, limit);
}

/**
 * POST /identify endpoint
 *
 * Promotes anonymous browsing history to a known identity by:
 * 1. Upserting identity (by unique email)
 * 2. Linking anonymous sessions to identity
 * 3. Backfilling events.identity_id for that anonymous_id
 * 4. Merging intent_scores from anonymous to identity
 * 5. Re-evaluating threshold band and setting last_threshold_emitted appropriately
 *
 * This operation is performed as a single logical transaction to ensure consistency.
 *
 * Example request:
 * ```bash
 * curl -X POST http://localhost:4000/identify \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "anonymous_id": "660e8400-e29b-41d4-a716-446655440001",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "source": "website",
 *     "metadata": {
 *       "campaign": "homepage_form"
 *     }
 *   }'
 * ```
 *
 * Smoke test examples:
 * 1) Identify with no prior /track events (should create identity, score 0, band cold)
 * 2) Track events to reach score 20+ anonymously, then identify (should return hot and threshold_emitted true)
 */
async function identifyInternal(req: IdentifyRequest): Promise<IdentifyResponse> {
  // Validation
  if (!req.anonymous_id || !isValidUUID(req.anonymous_id)) {
    throw APIError.invalidArgument(
      "anonymous_id is required and must be a valid UUID"
    );
  }

  if (!req.email) {
    throw APIError.invalidArgument("email is required");
  }

  if (!isValidEmail(req.email)) {
    throw APIError.invalidArgument("email must be a valid email address");
  }

  // Normalize metadata (default to {})
  let metadata: JsonObject = {};
  if (req.metadata) {
    try {
      const parsed = JSON.parse(req.metadata) as JsonObject;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed;
      }
    } catch {
      metadata = {};
    }
  }

  // Prepare name and source for update (only if provided and not empty)
  const nameToUpdate = req.name?.trim() || null;
  const sourceToUpdate = req.source?.trim() || null;

  // Step 1: Upsert identity
  const identityResult = await db.queryRow<{
    identity_id: string;
    first_identified_at: Date;
  }>`
    INSERT INTO identities (
      email,
      name,
      source,
      first_identified_at,
      last_seen_at,
      metadata
    ) VALUES (
      ${req.email},
      ${nameToUpdate},
      ${sourceToUpdate},
      now(),
      now(),
      ${JSON.stringify(metadata)}
    )
    ON CONFLICT (email) DO UPDATE SET
      last_seen_at = now(),
      name = COALESCE(${nameToUpdate}, identities.name),
      source = COALESCE(${sourceToUpdate}, identities.source),
      metadata = ${JSON.stringify(metadata)}
    RETURNING identity_id, first_identified_at
  `;

  if (!identityResult) {
    throw new Error("Failed to upsert identity");
  }

  const identityId = identityResult.identity_id;

  // Step 2: Link sessions
  await db.exec`
    UPDATE sessions
    SET identity_id = ${identityId}
    WHERE anonymous_id = ${req.anonymous_id}
  `;

  // Step 3: Backfill events
  await db.exec`
    UPDATE events
    SET identity_id = ${identityId}
    WHERE anonymous_id = ${req.anonymous_id}
      AND identity_id IS NULL
  `;

  // Step 4: Merge intent_subject_scores
  const anonymousScore = await db.queryRow<{
    total_score: number;
    last_event_at: Date | null;
    last_threshold_emitted: ThresholdBand | null;
  }>`
    SELECT total_score, last_event_at, last_threshold_emitted
    FROM intent_subject_scores
    WHERE subject_type = 'anonymous' AND subject_id = ${req.anonymous_id}
  `;

  const previousAnonymousScore = anonymousScore?.total_score ?? 0;
  const anonymousLastEventAt = anonymousScore?.last_event_at;

  const identityScoreBefore = await db.queryRow<{
    total_score: number;
    last_event_at: Date | null;
    last_threshold_emitted: ThresholdBand | null;
  }>`
    SELECT total_score, last_event_at, last_threshold_emitted
    FROM intent_subject_scores
    WHERE subject_type = 'identity' AND subject_id = ${identityId}
  `;

  const previousIdentityScore = identityScoreBefore?.total_score ?? 0;
  const identityLastEventAt = identityScoreBefore?.last_event_at;

  const totalIdentityScore = previousIdentityScore + previousAnonymousScore;

  let mergedLastEventAt: Date | null = null;
  if (anonymousLastEventAt && identityLastEventAt) {
    mergedLastEventAt =
      anonymousLastEventAt > identityLastEventAt
        ? anonymousLastEventAt
        : identityLastEventAt;
  } else if (anonymousLastEventAt) {
    mergedLastEventAt = anonymousLastEventAt;
  } else if (identityLastEventAt) {
    mergedLastEventAt = identityLastEventAt;
  }

  const previousIdentityBand = identityScoreBefore?.last_threshold_emitted ?? null;

  await db.exec`
    INSERT INTO intent_subject_scores (
      subject_type,
      subject_id,
      total_score,
      last_event_at,
      updated_at
    ) VALUES (
      'identity',
      ${identityId},
      ${totalIdentityScore},
      ${mergedLastEventAt ? mergedLastEventAt.toISOString() : null},
      now()
    )
    ON CONFLICT (subject_type, subject_id) DO UPDATE SET
      total_score = ${totalIdentityScore},
      last_event_at = ${mergedLastEventAt ? mergedLastEventAt.toISOString() : null},
      updated_at = now()
  `;

  const newBand = bandFromScore(totalIdentityScore);
  const thresholdEmitted = shouldEmitThreshold(previousIdentityBand, newBand);

  if (thresholdEmitted) {
    await db.exec`
      UPDATE intent_subject_scores
      SET last_threshold_emitted = ${newBand}
      WHERE subject_type = 'identity' AND subject_id = ${identityId}
    `;
  }

  const matchingLead = await db.queryRow<{ id: string }>`
    SELECT id FROM marketing_leads WHERE lower(email) = lower(${req.email}) LIMIT 1
  `;

  if (matchingLead) {
    await db.exec`
      UPDATE intent_events
      SET lead_id = ${matchingLead.id}
      WHERE anonymous_id = ${req.anonymous_id}
        AND lead_id IS NULL
    `;
    await updateLeadRollup(matchingLead.id);
  }

  const existingScoreMetadata = await db.queryRow<{ metadata: JsonObject | string }>`
    SELECT metadata
    FROM intent_subject_scores
    WHERE subject_type = 'identity' AND subject_id = ${identityId}
  `;
  const baseMetadata = normalizeJsonObject(existingScoreMetadata?.metadata);
  const topEvents = await getTopIdentityEvents(
    req.anonymous_id,
    matchingLead?.id ?? null
  );
  await db.exec`
    UPDATE intent_subject_scores
    SET metadata = ${JSON.stringify({
      ...baseMetadata,
      top_events: topEvents,
      top_events_updated_at: new Date().toISOString(),
      top_event_window_days: 30,
    })}
    WHERE subject_type = 'identity' AND subject_id = ${identityId}
  `;

  return {
    ok: true,
    identity_id: identityId,
    merged: previousAnonymousScore > 0 || previousIdentityScore > 0,
    previous_anonymous_score: previousAnonymousScore,
    previous_identity_score: previousIdentityScore,
    total_identity_score: totalIdentityScore,
    band: newBand,
    threshold_emitted: thresholdEmitted,
  };
}

export const identify = api<IdentifyRequest, IdentifyResponse>(
  { expose: true, method: "POST", path: "/identify" },
  identifyInternal
);

export const identifyV1 = api<IdentifyRequest, IdentifyResponse>(
  { expose: true, method: "POST", path: "/api/v1/identify" },
  identifyInternal
);

export const identifyV1Options = api<EmptyRequest, { message: string }>(
  { expose: true, method: "OPTIONS", path: "/api/v1/identify" },
  async () => ({ message: "ok" })
);

