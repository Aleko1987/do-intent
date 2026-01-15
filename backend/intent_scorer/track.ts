import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import {
  ALLOWED_EVENT_TYPES,
  EventType,
  ThresholdBand,
  parseOccurredAt,
  scoreDelta,
  bandFromScore,
  shouldEmitThreshold,
  normalizeEventType,
} from "./scoring";

// Request shape (v1)
interface TrackRequest {
  event_id?: string; // Optional but recommended for idempotency
  event: EventType;
  session_id: string;
  anonymous_id: string;
  url: string;
  referrer?: string;
  timestamp: number | string; // Unix seconds or ISO string
  value?: number; // Optional numeric (0-100 for scroll_depth/time_on_page)
  metadata?: Record<string, any>;
}

// Response shape
interface TrackResponse {
  ok: boolean;
  event_id: string;
  delta: number;
  total_score: number;
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
 * POST /track endpoint
 *
 * Validates incoming event payload, upserts session, inserts event,
 * updates intent score, and evaluates thresholds.
 *
 * Idempotency: If event_id is provided and conflicts (same PK), treat as success
 * and do not double-score. This is handled by catching the unique constraint violation
 * and returning the existing event's score delta.
 *
 * Scoring: Incremental scoring based on event type and conditions.
 * - page_view: +1 (+4 bonus if URL contains '/pricing')
 * - time_on_page: +2 if value > 30 seconds
 * - scroll_depth: +2 if value > 60 (0-100)
 * - click: +3 (+4 bonus if URL contains '/pricing')
 * - form_start: +6
 * - form_submit: +10
 *
 * Example request:
 * ```bash
 * curl -X POST http://localhost:4000/track \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "event": "page_view",
 *     "session_id": "550e8400-e29b-41d4-a716-446655440000",
 *     "anonymous_id": "660e8400-e29b-41d4-a716-446655440001",
 *     "url": "/pricing",
 *     "timestamp": 1700000000,
 *     "metadata": {
 *       "device": "mobile",
 *       "country": "ZA"
 *     }
 *   }'
 * ```
 */
export const track = api<TrackRequest, TrackResponse>(
  { expose: true, method: "POST", path: "/track" },
  async (req): Promise<TrackResponse> => {
    // Validation
    if (!req.session_id || !isValidUUID(req.session_id)) {
      throw APIError.invalidArgument(
        "session_id is required and must be a valid UUID"
      );
    }

    if (!req.anonymous_id || !isValidUUID(req.anonymous_id)) {
      throw APIError.invalidArgument(
        "anonymous_id is required and must be a valid UUID"
      );
    }

    // Validate and normalize event type
    let normalizedEvent: EventType;
    try {
      normalizedEvent = normalizeEventType(req.event);
    } catch (e: any) {
      throw APIError.invalidArgument(e.message);
    }

    if (!req.url || req.url.trim().length === 0) {
      throw APIError.invalidArgument("url is required and must be non-empty");
    }

    if (!req.timestamp) {
      throw APIError.invalidArgument("timestamp is required");
    }

    // Parse timestamp
    let occurredAt: Date;
    try {
      occurredAt = parseOccurredAt(req.timestamp);
    } catch (e) {
      throw APIError.invalidArgument("Invalid timestamp format");
    }

    // Normalize metadata (default to {})
    const metadata = req.metadata || {};

    // If request is authenticated, attach clerk userId to metadata
    try {
      const authData = getAuthData();
      if (authData?.userID) {
        metadata.clerk_user_id = authData.userID;
      }
    } catch {
      // Not authenticated - continue without userId (public tracker)
    }

    // Extract optional fields from metadata for session
    const userAgent = metadata.user_agent || metadata.userAgent || null;
    const device = metadata.device || null;
    const country = metadata.country || null;
    const ip = metadata.ip || null;

    // Generate event_id if not provided
    let eventId: string;
    if (req.event_id && isValidUUID(req.event_id)) {
      eventId = req.event_id;
    } else {
      // Generate UUID server-side
      const genResult = await db.queryRow<{ id: string }>`
        SELECT gen_random_uuid() as id
      `;
      eventId = genResult!.id;
    }

    // Calculate score delta
    const delta = scoreDelta(normalizedEvent, req.url, req.value);

    // Upsert session
    // If session_id not found, insert with first_seen_at/last_seen_at = occurred_at
    // Always update last_seen_at = occurred_at
    await db.exec`
      INSERT INTO sessions (
        session_id,
        anonymous_id,
        first_seen_at,
        last_seen_at,
        user_agent,
        device,
        country,
        ip,
        metadata
      ) VALUES (
        ${req.session_id},
        ${req.anonymous_id},
        ${occurredAt.toISOString()},
        ${occurredAt.toISOString()},
        ${userAgent},
        ${device},
        ${country},
        ${ip},
        ${JSON.stringify(metadata)}
      )
      ON CONFLICT (session_id) DO UPDATE SET
        last_seen_at = ${occurredAt.toISOString()},
        user_agent = COALESCE(EXCLUDED.user_agent, sessions.user_agent),
        device = COALESCE(EXCLUDED.device, sessions.device),
        country = COALESCE(EXCLUDED.country, sessions.country),
        ip = COALESCE(EXCLUDED.ip, sessions.ip),
        metadata = EXCLUDED.metadata
    `;

    // Insert event (with idempotency handling)
    // If event_id conflicts, we'll catch it and return existing event's score
    let eventInserted = false;
    try {
      await db.exec`
        INSERT INTO events (
          event_id,
          session_id,
          anonymous_id,
          identity_id,
          event_type,
          event_value,
          url,
          referrer,
          occurred_at,
          received_at,
          metadata
        ) VALUES (
          ${eventId},
          ${req.session_id},
          ${req.anonymous_id},
          NULL,
          ${normalizedEvent},
          ${req.value ?? null},
          ${req.url},
          ${req.referrer ?? null},
          ${occurredAt.toISOString()},
          now(),
          ${JSON.stringify(metadata)}
        )
      `;
      eventInserted = true;
    } catch (error: any) {
      // If event_id conflicts (unique constraint violation), treat as success
      // but we need to check if this event was already scored
      if (error.code === "23505") {
        // Unique violation - event already exists
        // Check if this event was already processed
        const existingEvent = await db.queryRow<{
          event_id: string;
          occurred_at: Date;
        }>`
          SELECT event_id, occurred_at
          FROM events
          WHERE event_id = ${eventId}
        `;

        if (existingEvent) {
          // Event exists, return zero delta (idempotency)
          // Get current score for the anonymous_id
          const currentScore = await db.queryRow<{
            total_score: number;
            last_threshold_emitted: ThresholdBand | null;
          }>`
            SELECT total_score, last_threshold_emitted
            FROM intent_scores
            WHERE subject_type = 'anonymous' AND subject_id = ${req.anonymous_id}
          `;

          const totalScore = currentScore?.total_score ?? 0;
          const band = bandFromScore(totalScore);

          return {
            ok: true,
            event_id: eventId,
            delta: 0, // No delta for duplicate event
            total_score: totalScore,
            band,
            threshold_emitted: false, // No threshold emission for duplicate
          };
        }
      }
      // Re-throw if it's not a unique constraint violation
      throw error;
    }

    // Only proceed with scoring if event was successfully inserted
    if (!eventInserted) {
      throw new Error("Failed to insert event");
    }

    // Update intent_scores (anonymous subject)
    // Create row if not exists with total_score=0
    // Update total_score += delta, last_event_at = occurred_at, updated_at = now()
    const scoreResult = await db.queryRow<{
      total_score: number;
      last_threshold_emitted: ThresholdBand | null;
    }>`
      INSERT INTO intent_scores (
        subject_type,
        subject_id,
        total_score,
        last_event_at,
        updated_at
      ) VALUES (
        'anonymous',
        ${req.anonymous_id},
        ${delta},
        ${occurredAt.toISOString()},
        now()
      )
      ON CONFLICT (subject_type, subject_id) DO UPDATE SET
        total_score = intent_scores.total_score + ${delta},
        last_event_at = ${occurredAt.toISOString()},
        updated_at = now()
      RETURNING total_score, last_threshold_emitted
    `;

    if (!scoreResult) {
      throw new Error("Failed to update intent score");
    }

    const totalScore = scoreResult.total_score;
    const newBand = bandFromScore(totalScore);
    const lastThresholdEmitted = scoreResult.last_threshold_emitted;

    // Evaluate thresholds using helper
    const thresholdEmitted = shouldEmitThreshold(
      lastThresholdEmitted,
      newBand
    );
    const shouldUpdateThreshold = thresholdEmitted;

    // Update last_threshold_emitted if needed
    if (shouldUpdateThreshold) {
      await db.exec`
        UPDATE intent_scores
        SET last_threshold_emitted = ${newBand}
        WHERE subject_type = 'anonymous' AND subject_id = ${req.anonymous_id}
      `;
    }

    return {
      ok: true,
      event_id: eventId,
      delta,
      total_score: totalScore,
      band: newBand,
      threshold_emitted: thresholdEmitted,
    };
  }
);

