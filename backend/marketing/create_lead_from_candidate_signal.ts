import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { CandidateSignal, CandidateSignalReview } from "./candidate_signal_types";
import { fetchCandidateSignalById } from "./candidate_signal_service";
import type { MarketingLead } from "./types";

interface CreateLeadFromCandidateSignalRequest {
  id: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source_type?: "manual" | "website" | "other";
  reason?: string;
}

interface CreateLeadFromCandidateSignalResponse {
  lead: MarketingLead;
  candidate_signal: CandidateSignal;
  review: CandidateSignalReview;
}

// Creates a lead from a reviewed candidate signal and links the signal to that lead.
export const createLeadFromCandidateSignal = api<
  CreateLeadFromCandidateSignalRequest,
  CreateLeadFromCandidateSignalResponse
>(
  { expose: true, method: "POST", path: "/marketing/candidate-signals/:id/create-lead", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const candidateSignal = await fetchCandidateSignalById(req.id, authData.userID);

    const lead = await db.queryRow<MarketingLead>`
      INSERT INTO marketing_leads (
        company_name,
        contact_name,
        email,
        phone,
        anonymous_id,
        source_type,
        owner_user_id,
        marketing_stage,
        intent_score,
        created_at,
        updated_at
      ) VALUES (
        ${req.company_name ?? null},
        ${req.contact_name ?? candidateSignal.actor_display ?? null},
        ${req.email ?? null},
        ${req.phone ?? null},
        ${candidateSignal.anonymous_id},
        ${req.source_type ?? "manual"},
        ${authData.userID},
        ${candidateSignal.suggested_stage ?? "M1"},
        0,
        now(),
        now()
      )
      RETURNING *
    `;

    if (!lead) {
      throw APIError.internal("failed to create lead from candidate signal");
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
      throw APIError.internal("failed to update candidate signal after lead creation");
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
        'create_lead',
        ${req.reason ?? null},
        ${JSON.stringify({ lead_id: candidateSignal.lead_id, status: candidateSignal.status })},
        ${JSON.stringify({ lead_id: updatedSignal.lead_id, status: updatedSignal.status })},
        ${lead.id},
        now()
      )
      RETURNING *
    `;

    if (!review) {
      throw APIError.internal("failed to write create_lead review record");
    }

    return {
      lead,
      candidate_signal: updatedSignal,
      review,
    };
  }
);
