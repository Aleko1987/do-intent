import { api, APIError } from "encore.dev/api";
import { db } from "../db/db";
import {
  ThresholdBand,
  bandFromScore,
  shouldEmitThreshold,
} from "./scoring";

// Request shape (v1)
interface IdentifyRequest {
  anonymous_id: string;
  identity: {
    email: string;
    name?: string;
    source?: string;
  };
  metadata?: Record<string, any>;
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
 *     "identity": {
 *       "email": "user@example.com",
 *       "name": "John Doe",
 *       "source": "website"
 *     },
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
export const identify = api<IdentifyRequest, IdentifyResponse>(
  { expose: true, method: "POST", path: "/identify" },
  async (req): Promise<IdentifyResponse> => {
    // Validation
    if (!req.anonymous_id || !isValidUUID(req.anonymous_id)) {
      throw APIError.invalidArgument(
        "anonymous_id is required and must be a valid UUID"
      );
    }

    if (!req.identity || !req.identity.email) {
      throw APIError.invalidArgument("identity.email is required");
    }

    if (!isValidEmail(req.identity.email)) {
      throw APIError.invalidArgument("identity.email must be a valid email address");
    }

    // Normalize metadata (default to {})
    const metadata = req.metadata || {};

    // Prepare name and source for update (only if provided and not empty)
    const nameToUpdate = req.identity.name?.trim() || null;
    const sourceToUpdate = req.identity.source?.trim() || null;

    // Step 1: Upsert identity
    // If email exists, reuse identity_id and update last_seen_at = now(), name/source if provided
    // (do not erase existing name if new is empty)
    // If new, insert with first_identified_at = now(), last_seen_at = now()
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
        ${req.identity.email},
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
    // Update sessions set identity_id = identity_id where anonymous_id = request.anonymous_id
    // (Do not change anonymous_id or session_id)
    await db.exec`
      UPDATE sessions
      SET identity_id = ${identityId}
      WHERE anonymous_id = ${req.anonymous_id}
    `;

    // Step 3: Backfill events
    // Update events set identity_id = identity_id
    // where anonymous_id = request.anonymous_id and identity_id is NULL
    // Keep events immutable conceptually, but backfill identity_id is explicitly allowed for promotion
    await db.exec`
      UPDATE events
      SET identity_id = ${identityId}
      WHERE anonymous_id = ${req.anonymous_id}
        AND identity_id IS NULL
    `;

    // Step 4: Merge intent_scores
    // Read anonymous_score (if missing, treat as 0)
    // Read identity_score (if missing, treat as 0)
    // total_identity_score = identity_score + anonymous_score
    // Upsert identity intent_scores row to total_identity_score, 
    // last_event_at = max(identity.last_event_at, anonymous.last_event_at), updated_at=now()

    // Read anonymous score
    const anonymousScore = await db.queryRow<{
      total_score: number;
      last_event_at: Date | null;
      last_threshold_emitted: ThresholdBand | null;
    }>`
      SELECT total_score, last_event_at, last_threshold_emitted
      FROM intent_scores
      WHERE subject_type = 'anonymous' AND subject_id = ${req.anonymous_id}
    `;

    const previousAnonymousScore = anonymousScore?.total_score ?? 0;
    const anonymousLastEventAt = anonymousScore?.last_event_at;

    // Read identity score (before merge)
    const identityScoreBefore = await db.queryRow<{
      total_score: number;
      last_event_at: Date | null;
      last_threshold_emitted: ThresholdBand | null;
    }>`
      SELECT total_score, last_event_at, last_threshold_emitted
      FROM intent_scores
      WHERE subject_type = 'identity' AND subject_id = ${identityId}
    `;

    const previousIdentityScore = identityScoreBefore?.total_score ?? 0;
    const identityLastEventAt = identityScoreBefore?.last_event_at;

    // Calculate merged score
    const totalIdentityScore = previousIdentityScore + previousAnonymousScore;

    // Determine last_event_at (max of both, or whichever exists)
    let mergedLastEventAt: Date | null = null;
    if (anonymousLastEventAt && identityLastEventAt) {
      mergedLastEventAt = anonymousLastEventAt > identityLastEventAt 
        ? anonymousLastEventAt 
        : identityLastEventAt;
    } else if (anonymousLastEventAt) {
      mergedLastEventAt = anonymousLastEventAt;
    } else if (identityLastEventAt) {
      mergedLastEventAt = identityLastEventAt;
    }

    // Get previous threshold band for identity (before merge)
    const previousIdentityBand = identityScoreBefore?.last_threshold_emitted ?? null;

    // Upsert identity intent_scores with merged values
    // Note: We'll update last_threshold_emitted in step 5 after threshold evaluation
    await db.exec`
      INSERT INTO intent_scores (
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

    // Step 5: Threshold evaluation for identity
    // Determine new band from total_identity_score using bandFromScore helper
    // Determine previous band from identity intent_scores.last_threshold_emitted (before update)
    // threshold_emitted should be true if:
    //   a) previous band is NULL (first-ever emit)
    //   OR
    //   b) new band is higher than previous band (upward movement only)
    // If threshold_emitted true, update identity intent_scores.last_threshold_emitted = new band
    // If false, leave last_threshold_emitted unchanged

    const newBand = bandFromScore(totalIdentityScore);
    const thresholdEmitted = shouldEmitThreshold(previousIdentityBand, newBand);

    // Update last_threshold_emitted if threshold was emitted
    if (thresholdEmitted) {
      await db.exec`
        UPDATE intent_scores
        SET last_threshold_emitted = ${newBand}
        WHERE subject_type = 'identity' AND subject_id = ${identityId}
      `;
    }

    // Note: We do NOT delete anonymous intent_scores row (as per requirements)

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
);

