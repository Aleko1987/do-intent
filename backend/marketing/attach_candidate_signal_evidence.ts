import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { CandidateSignal, CandidateSignalEvidence } from "./candidate_signal_types";
import { attachEvidenceToSignal } from "./candidate_signal_intake_helpers";

interface AttachCandidateSignalEvidenceRequest {
  id: string;
  reminder_id?: string;
  evidence_type: "screenshot" | "platform_export" | "url" | "manual_note" | "api_payload";
  storage_kind: "external_url" | "internal_path" | "inline";
  evidence_ref: string;
  mime_type?: string;
  sha256?: string;
  captured_at?: string;
  redaction_status?: "not_required" | "pending" | "redacted";
  is_sensitive?: boolean;
  metadata?: string;
}

interface AttachCandidateSignalEvidenceResponse {
  evidence: CandidateSignalEvidence;
  candidate_signal: CandidateSignal;
}

// Attaches optional evidence artifacts. Evidence is never treated as a sole source of truth.
export const attachCandidateSignalEvidence = api<
  AttachCandidateSignalEvidenceRequest,
  AttachCandidateSignalEvidenceResponse
>(
  { expose: true, method: "POST", path: "/marketing/candidate-signals/:id/evidence", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }
    const result = await attachEvidenceToSignal({
      signalId: req.id,
      ownerUserId: authData.userID,
      reminderId: req.reminder_id,
      evidenceType: req.evidence_type,
      storageKind: req.storage_kind,
      evidenceRef: req.evidence_ref,
      mimeType: req.mime_type,
      sha256: req.sha256,
      capturedAt: req.captured_at,
      redactionStatus: req.redaction_status,
      isSensitive: req.is_sensitive,
      metadata: req.metadata,
      createdByUserId: authData.userID,
      updateSignalStatus: true,
    });

    return { evidence: result.evidence, candidate_signal: result.candidateSignal };
  }
);
