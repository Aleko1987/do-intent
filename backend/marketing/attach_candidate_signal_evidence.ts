import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { CandidateSignalEvidence } from "./candidate_signal_types";
import { fetchCandidateSignalById } from "./candidate_signal_service";

interface AttachCandidateSignalEvidenceRequest {
  id: string;
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
}

function parseMetadata(metadata: string | undefined): JsonObject {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as JsonObject;
  } catch {
    return {};
  }
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

    const signal = await fetchCandidateSignalById(req.id, authData.userID);
    const metadata = parseMetadata(req.metadata);

    const evidence = await db.queryRow<CandidateSignalEvidence>`
      INSERT INTO candidate_signal_evidence (
        candidate_signal_id,
        evidence_type,
        storage_kind,
        evidence_ref,
        mime_type,
        sha256,
        captured_at,
        redaction_status,
        is_sensitive,
        metadata,
        created_by_user_id,
        created_at
      ) VALUES (
        ${signal.id},
        ${req.evidence_type},
        ${req.storage_kind},
        ${req.evidence_ref},
        ${req.mime_type ?? null},
        ${req.sha256 ?? null},
        ${req.captured_at ?? null},
        ${req.redaction_status ?? "not_required"},
        ${req.is_sensitive ?? true},
        ${JSON.stringify(metadata)},
        ${authData.userID},
        now()
      )
      RETURNING *
    `;

    if (!evidence) {
      throw APIError.internal("failed to attach candidate evidence");
    }

    return { evidence };
  }
);
