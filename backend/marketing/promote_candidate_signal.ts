import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { CandidateSignalReview } from "./candidate_signal_types";
import { fetchCandidateSignalById, normalizeEventType, promoteCandidateSignalToIntentEvent } from "./candidate_signal_service";
import type { IntentEvent } from "./types";

interface PromoteCandidateSignalRequest {
  id: string;
  lead_id?: string;
  event_type?: string;
  reason?: string;
}

interface PromoteCandidateSignalResponse {
  event: IntentEvent;
  auto_pushed: boolean;
  review: CandidateSignalReview;
}

// Promotes an approved candidate signal into canonical intent_events.
export const promoteCandidateSignal = api<PromoteCandidateSignalRequest, PromoteCandidateSignalResponse>(
  { expose: true, method: "POST", path: "/marketing/candidate-signals/:id/promote", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const signal = await fetchCandidateSignalById(req.id, authData.userID);

    if (signal.status !== "approved") {
      throw APIError.failedPrecondition("candidate signal must be approved before promotion");
    }

    const selectedLeadId = req.lead_id ?? signal.lead_id;
    if (!selectedLeadId) {
      throw APIError.invalidArgument("lead_id is required for promotion");
    }

    const lead = await db.queryRow<{ id: string }>`
      SELECT id
      FROM marketing_leads
      WHERE id = ${selectedLeadId}
        AND owner_user_id = ${authData.userID}
    `;
    if (!lead) {
      throw APIError.notFound("lead not found");
    }

    const selectedEventType = req.event_type
      ? normalizeEventType(req.event_type)
      : signal.suggested_event_type ?? signal.signal_type;

    const promoted = await promoteCandidateSignalToIntentEvent({
      candidateSignal: signal,
      ownerUserId: authData.userID,
      eventType: selectedEventType,
      overrideLeadId: selectedLeadId,
    });

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
        promoted_event_id,
        created_at
      ) VALUES (
        ${signal.id},
        ${authData.userID},
        'promote',
        ${req.reason ?? null},
        ${JSON.stringify({ status: signal.status, promoted_event_id: signal.promoted_event_id })},
        ${JSON.stringify({ status: "promoted", promoted_event_id: promoted.event.id })},
        ${promoted.event.event_type},
        ${signal.suggested_stage},
        ${signal.suggested_intent_score},
        ${promoted.event.lead_id},
        ${promoted.event.id},
        now()
      )
      RETURNING *
    `;

    if (!review) {
      throw APIError.internal("failed to record promotion review");
    }

    return {
      event: promoted.event,
      auto_pushed: promoted.autoPushed,
      review,
    };
  }
);
