import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type {
  CandidateSignal,
  CandidateSignalEventType,
  CandidateSignalReview,
  CandidateSignalStatus,
} from "./candidate_signal_types";
import { fetchCandidateSignalById, normalizeEventType, promoteCandidateSignalToIntentEvent } from "./candidate_signal_service";
import type { IntentEvent } from "./types";

interface ReviewCandidateSignalRequest {
  id: string;
  decision: "approve" | "reject" | "edit";
  decision_reason?: string;
  set_status?: "pending_review" | "approved" | "rejected" | "needs_evidence" | "reminder_sent" | "evidence_attached";
  set_lead_id?: string;
  set_event_type?: string;
  set_stage?: "M1" | "M2" | "M3" | "M4" | "M5";
  set_intent_score?: number;
  metadata_patch?: string;
  promote_now?: boolean;
}

interface ReviewCandidateSignalResponse {
  review: CandidateSignalReview;
  candidate_signal: CandidateSignal;
  promoted_event?: IntentEvent;
  auto_pushed?: boolean;
}

function parseMetadataPatch(rawPatch: string | undefined): JsonObject {
  if (!rawPatch) return {};

  try {
    const parsed = JSON.parse(rawPatch);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as JsonObject;
  } catch {
    return {};
  }
}

function normalizeReviewStatus(input: string | undefined, decision: ReviewCandidateSignalRequest["decision"]): CandidateSignalStatus {
  if (input) {
    if (!["pending_review", "approved", "rejected", "needs_evidence", "reminder_sent", "evidence_attached"].includes(input)) {
      throw APIError.invalidArgument("invalid set_status");
    }
    return input as CandidateSignalStatus;
  }

  if (decision === "approve") return "approved";
  if (decision === "reject") return "rejected";
  return "pending_review";
}

// Records explicit human review actions for candidate signals.
export const reviewCandidateSignal = api<ReviewCandidateSignalRequest, ReviewCandidateSignalResponse>(
  { expose: true, method: "POST", path: "/marketing/candidate-signals/:id/reviews", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const existing = await fetchCandidateSignalById(req.id, authData.userID);
    const patch = parseMetadataPatch(req.metadata_patch);
    const selectedStatus = normalizeReviewStatus(req.set_status, req.decision);
    const selectedEventType: CandidateSignalEventType | null = req.set_event_type
      ? normalizeEventType(req.set_event_type)
      : existing.suggested_event_type;

    const mergedMetadata: JsonObject = {
      ...(existing.metadata ?? {}),
      ...patch,
    };

    const updatedSignal = await db.queryRow<CandidateSignal>`
      UPDATE candidate_signals
      SET
        status = ${selectedStatus},
        lead_id = ${req.set_lead_id ?? existing.lead_id},
        suggested_event_type = ${selectedEventType},
        suggested_stage = ${req.set_stage ?? existing.suggested_stage},
        suggested_intent_score = ${req.set_intent_score ?? existing.suggested_intent_score},
        metadata = ${JSON.stringify(mergedMetadata)},
        last_reviewed_at = now(),
        updated_at = now()
      WHERE id = ${existing.id}
        AND owner_user_id = ${authData.userID}
      RETURNING *
    `;

    if (!updatedSignal) {
      throw APIError.internal("failed to update candidate signal during review");
    }

    const review = await db.queryRow<CandidateSignalReview>`
      INSERT INTO candidate_signal_reviews (
        candidate_signal_id,
        reviewer_user_id,
        decision,
        decision_reason,
        before_payload,
        after_payload,
        applied_event_type,
        applied_stage,
        applied_intent_score,
        applied_lead_id,
        created_at
      ) VALUES (
        ${existing.id},
        ${authData.userID},
        ${req.decision},
        ${req.decision_reason ?? null},
        ${JSON.stringify({
          status: existing.status,
          lead_id: existing.lead_id,
          suggested_event_type: existing.suggested_event_type,
          suggested_stage: existing.suggested_stage,
          suggested_intent_score: existing.suggested_intent_score,
        } satisfies JsonObject)},
        ${JSON.stringify({
          status: updatedSignal.status,
          lead_id: updatedSignal.lead_id,
          suggested_event_type: updatedSignal.suggested_event_type,
          suggested_stage: updatedSignal.suggested_stage,
          suggested_intent_score: updatedSignal.suggested_intent_score,
        } satisfies JsonObject)},
        ${updatedSignal.suggested_event_type},
        ${updatedSignal.suggested_stage},
        ${updatedSignal.suggested_intent_score},
        ${updatedSignal.lead_id},
        now()
      )
      RETURNING *
    `;

    if (!review) {
      throw APIError.internal("failed to persist candidate review");
    }

    if (req.promote_now) {
      const promoted = await promoteCandidateSignalToIntentEvent({
        candidateSignal: updatedSignal,
        ownerUserId: authData.userID,
        eventType: updatedSignal.suggested_event_type,
      });
      return {
        review,
        candidate_signal: {
          ...updatedSignal,
          promoted_event_id: promoted.event.id,
          status: "promoted",
        },
        promoted_event: promoted.event,
        auto_pushed: promoted.autoPushed,
      };
    }

    return {
      review,
      candidate_signal: updatedSignal,
    };
  }
);
