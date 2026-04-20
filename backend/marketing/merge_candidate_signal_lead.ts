import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { CandidateSignal, CandidateSignalReview } from "./candidate_signal_types";
import { fetchCandidateSignalById } from "./candidate_signal_service";
import type { MarketingLead } from "./types";

interface MergeCandidateSignalLeadRequest {
  id: string;
  lead_id: string;
  reason?: string;
}

interface MergeCandidateSignalLeadResponse {
  candidate_signal: CandidateSignal;
  lead: MarketingLead;
  review: CandidateSignalReview;
}

// Merges a candidate signal into an existing lead match (without promotion).
export const mergeCandidateSignalLead = api<
  MergeCandidateSignalLeadRequest,
  MergeCandidateSignalLeadResponse
>(
  { expose: true, method: "POST", path: "/marketing/candidate-signals/:id/merge-lead", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const candidateSignal = await fetchCandidateSignalById(req.id, authData.userID);

    const lead = await db.queryRow<MarketingLead>`
      SELECT *
      FROM marketing_leads
      WHERE id = ${req.lead_id}
        AND owner_user_id = ${authData.userID}
    `;

    if (!lead) {
      throw APIError.notFound("lead not found");
    }

    const updatedSignal = await db.queryRow<CandidateSignal>`
      UPDATE candidate_signals
      SET
        lead_id = ${lead.id},
        status = CASE
          WHEN status = 'rejected' THEN 'pending_review'
          ELSE status
        END,
        last_reviewed_at = now(),
        updated_at = now()
      WHERE id = ${candidateSignal.id}
      RETURNING *
    `;

    if (!updatedSignal) {
      throw APIError.internal("failed to merge candidate signal with lead");
    }

    const review = await db.queryRow<CandidateSignalReview>`
      INSERT INTO candidate_signal_reviews (
        candidate_signal_id,
        reviewer_user_id,
        decision,
        decision_reason,
        before_payload,
        after_payload,
        applied_lead_id,
        created_at
      ) VALUES (
        ${candidateSignal.id},
        ${authData.userID},
        'merge',
        ${req.reason ?? null},
        ${JSON.stringify({ lead_id: candidateSignal.lead_id, status: candidateSignal.status })},
        ${JSON.stringify({ lead_id: updatedSignal.lead_id, status: updatedSignal.status })},
        ${lead.id},
        now()
      )
      RETURNING *
    `;

    if (!review) {
      throw APIError.internal("failed to write merge review");
    }

    return {
      candidate_signal: updatedSignal,
      lead,
      review,
    };
  }
);
