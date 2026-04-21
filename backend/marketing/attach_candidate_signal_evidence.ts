import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { CandidateSignal, CandidateSignalEvidence } from "./candidate_signal_types";
import { fetchCandidateSignalById } from "./candidate_signal_service";

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

    if (req.reminder_id) {
      const reminder = await db.queryRow<{ id: string }>`
        SELECT id
        FROM candidate_signal_reminders
        WHERE id = ${req.reminder_id}
          AND candidate_signal_id = ${signal.id}
          AND owner_user_id = ${authData.userID}
      `;

      if (!reminder) {
        throw APIError.invalidArgument("reminder_id does not belong to candidate signal");
      }
    }

    const evidence = await db.queryRow<CandidateSignalEvidence>`
      INSERT INTO candidate_signal_evidence (
        candidate_signal_id,
        reminder_id,
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
        ${req.reminder_id ?? null},
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

    if (req.reminder_id) {
      await db.exec`
        UPDATE candidate_signal_reminders
        SET
          delivery_status = 'replied',
          responded_at = COALESCE(responded_at, now()),
          last_updated_by_user_id = ${authData.userID},
          updated_at = now()
        WHERE id = ${req.reminder_id}
          AND candidate_signal_id = ${signal.id}
          AND owner_user_id = ${authData.userID}
      `;
    }

    const updatedSignal = await db.queryRow<CandidateSignal>`
      UPDATE candidate_signals
      SET
        status = 'evidence_attached',
        updated_at = now()
      WHERE id = ${signal.id}
        AND owner_user_id = ${authData.userID}
      RETURNING *
    `;

    if (!updatedSignal) {
      throw APIError.internal("failed to update candidate signal after evidence attach");
    }

    return { evidence, candidate_signal: updatedSignal };
  }
);
