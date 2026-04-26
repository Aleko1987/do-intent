import { APIError } from "encore.dev/api";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { CandidateSignal, CandidateSignalEvidence } from "./candidate_signal_types";
import { normalizeChannel, normalizeEventType, normalizeSourceType, proposePromotion } from "./candidate_signal_service";

export interface CandidateSignalInsertInput {
  ownerUserId: string;
  channel: string;
  sourceType: string;
  sourceRef?: string;
  externalAccountRef?: string;
  leadId?: string;
  anonymousId?: string;
  signalType: string;
  summary?: string;
  rawText?: string;
  actorDisplay?: string;
  actorHandle?: string;
  identityStatus?: "aggregate_only" | "deterministic" | "probable" | "unknown";
  identityConfidence?: number;
  identityKeyHash?: string;
  dedupeKey?: string;
  metadata?: string;
  occurredAt?: string;
}

export interface CandidateSignalInsertResult {
  candidateSignal: CandidateSignal;
  deduped: boolean;
}

export interface CandidateSignalEvidenceInsertInput {
  signalId: string;
  ownerUserId: string;
  reminderId?: string;
  evidenceType: "screenshot" | "platform_export" | "url" | "manual_note" | "api_payload";
  storageKind: "external_url" | "internal_path" | "inline";
  evidenceRef: string;
  mimeType?: string;
  sha256?: string;
  capturedAt?: string;
  redactionStatus?: "not_required" | "pending" | "redacted";
  isSensitive?: boolean;
  metadata?: string;
  createdByUserId?: string;
  updateSignalStatus?: boolean;
}

function sanitizeIsoString(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
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

function mergeMetadata(existing: JsonObject, incoming: JsonObject): JsonObject {
  return { ...existing, ...incoming };
}

export function parseMetadataString(metadata: string | undefined): JsonObject {
  return parseMetadata(metadata);
}

export async function createCandidateSignalForOwner(
  input: CandidateSignalInsertInput
): Promise<CandidateSignalInsertResult> {
  const channel = normalizeChannel(input.channel);
  const sourceType = normalizeSourceType(input.sourceType);
  const signalType = normalizeEventType(input.signalType);
  const metadata = parseMetadata(input.metadata);
  const occurredAt = sanitizeIsoString(input.occurredAt) ?? new Date().toISOString();

  if (input.identityStatus === "aggregate_only" && input.leadId) {
    throw APIError.invalidArgument("aggregate_only signals cannot be directly bound to a lead");
  }

  const suggestion = proposePromotion({
    suggestedEventType: input.signalType,
    summary: input.summary,
    rawText: input.rawText,
  });

  let existing: CandidateSignal | null = null;
  if (input.dedupeKey) {
    existing = await db.queryRow<CandidateSignal>`
      SELECT *
      FROM candidate_signals
      WHERE owner_user_id = ${input.ownerUserId}
        AND channel = ${channel}
        AND dedupe_key = ${input.dedupeKey}
    `;
  }

  if (existing) {
    if (Object.keys(metadata).length > 0) {
      const merged = mergeMetadata(existing.metadata ?? {}, metadata);
      const updated = await db.queryRow<CandidateSignal>`
        UPDATE candidate_signals
        SET
          metadata = ${JSON.stringify(merged)},
          updated_at = now()
        WHERE id = ${existing.id}
          AND owner_user_id = ${input.ownerUserId}
        RETURNING *
      `;
      return { candidateSignal: updated ?? existing, deduped: true };
    }
    return { candidateSignal: existing, deduped: true };
  }

  const created = await db.queryRow<CandidateSignal>`
    INSERT INTO candidate_signals (
      owner_user_id,
      channel,
      source_type,
      source_ref,
      external_account_ref,
      lead_id,
      anonymous_id,
      signal_type,
      summary,
      raw_text,
      actor_display,
      actor_handle,
      identity_status,
      identity_confidence,
      identity_key_hash,
      suggested_event_type,
      suggested_stage,
      suggested_reason,
      suggestion_confidence,
      dedupe_key,
      metadata,
      occurred_at,
      created_at,
      updated_at
    ) VALUES (
      ${input.ownerUserId},
      ${channel},
      ${sourceType},
      ${input.sourceRef ?? null},
      ${input.externalAccountRef ?? null},
      ${input.leadId ?? null},
      ${input.anonymousId ?? null},
      ${signalType},
      ${input.summary ?? null},
      ${input.rawText ?? null},
      ${input.actorDisplay ?? null},
      ${input.actorHandle ?? null},
      ${input.identityStatus ?? "unknown"},
      ${input.identityConfidence ?? suggestion.confidence},
      ${input.identityKeyHash ?? null},
      ${suggestion.suggestedEventType},
      ${suggestion.suggestedStage},
      ${suggestion.reason},
      ${suggestion.confidence},
      ${input.dedupeKey ?? null},
      ${JSON.stringify(metadata)},
      ${occurredAt},
      now(),
      now()
    )
    RETURNING *
  `;

  if (!created) {
    throw APIError.internal("failed to create candidate signal");
  }
  return { candidateSignal: created, deduped: false };
}

export async function attachEvidenceToSignal(
  input: CandidateSignalEvidenceInsertInput
): Promise<{ evidence: CandidateSignalEvidence; candidateSignal: CandidateSignal }> {
  const metadata = parseMetadata(input.metadata);
  const signal = await db.queryRow<CandidateSignal>`
    SELECT *
    FROM candidate_signals
    WHERE id = ${input.signalId}
      AND owner_user_id = ${input.ownerUserId}
  `;
  if (!signal) {
    throw APIError.notFound("candidate signal not found");
  }

  if (input.reminderId) {
    const reminder = await db.queryRow<{ id: string }>`
      SELECT id
      FROM candidate_signal_reminders
      WHERE id = ${input.reminderId}
        AND candidate_signal_id = ${signal.id}
        AND owner_user_id = ${input.ownerUserId}
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
      ${input.reminderId ?? null},
      ${input.evidenceType},
      ${input.storageKind},
      ${input.evidenceRef},
      ${input.mimeType ?? null},
      ${input.sha256 ?? null},
      ${sanitizeIsoString(input.capturedAt)},
      ${input.redactionStatus ?? "not_required"},
      ${input.isSensitive ?? true},
      ${JSON.stringify(metadata)},
      ${input.createdByUserId ?? input.ownerUserId},
      now()
    )
    RETURNING *
  `;

  if (!evidence) {
    throw APIError.internal("failed to attach candidate evidence");
  }

  if (input.reminderId) {
    await db.exec`
      UPDATE candidate_signal_reminders
      SET
        delivery_status = 'replied',
        responded_at = COALESCE(responded_at, now()),
        last_updated_by_user_id = ${input.createdByUserId ?? input.ownerUserId},
        updated_at = now()
      WHERE id = ${input.reminderId}
        AND candidate_signal_id = ${signal.id}
        AND owner_user_id = ${input.ownerUserId}
    `;
  }

  const updatedSignal = input.updateSignalStatus === false
    ? await db.queryRow<CandidateSignal>`
        UPDATE candidate_signals
        SET updated_at = now()
        WHERE id = ${signal.id}
          AND owner_user_id = ${input.ownerUserId}
        RETURNING *
      `
    : await db.queryRow<CandidateSignal>`
        UPDATE candidate_signals
        SET
          status = 'evidence_attached',
          updated_at = now()
        WHERE id = ${signal.id}
          AND owner_user_id = ${input.ownerUserId}
        RETURNING *
      `;

  if (!updatedSignal) {
    throw APIError.internal("failed to update candidate signal after evidence attach");
  }

  return { evidence, candidateSignal: updatedSignal };
}
