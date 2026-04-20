import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { CandidateSignal } from "./candidate_signal_types";
import {
  normalizeChannel,
  normalizeEventType,
  normalizeSourceType,
  proposePromotion,
} from "./candidate_signal_service";

interface IngestCandidateSignalRequest {
  channel: string;
  source_type: string;
  source_ref?: string;
  external_account_ref?: string;
  lead_id?: string;
  anonymous_id?: string;
  signal_type: string;
  summary?: string;
  raw_text?: string;
  actor_display?: string;
  actor_handle?: string;
  identity_status?: "aggregate_only" | "deterministic" | "probable" | "unknown";
  identity_confidence?: number;
  identity_key_hash?: string;
  dedupe_key?: string;
  metadata?: string;
  occurred_at?: string;
}

interface IngestCandidateSignalResponse {
  candidate_signal: CandidateSignal;
  deduped: boolean;
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

// Stores a conservative candidate signal that must pass review before canonical promotion.
export const ingestCandidateSignal = api<IngestCandidateSignalRequest, IngestCandidateSignalResponse>(
  { expose: true, method: "POST", path: "/marketing/candidate-signals", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const channel = normalizeChannel(req.channel);
    const sourceType = normalizeSourceType(req.source_type);
    const signalType = normalizeEventType(req.signal_type);
    const metadata = parseMetadata(req.metadata);

    if (req.identity_status === "aggregate_only" && req.lead_id) {
      throw APIError.invalidArgument("aggregate_only signals cannot be directly bound to a lead");
    }

    const suggestion = proposePromotion({
      suggestedEventType: req.signal_type,
      summary: req.summary,
      rawText: req.raw_text,
    });

    let existing: CandidateSignal | null = null;
    if (req.dedupe_key) {
      existing = await db.queryRow<CandidateSignal>`
        SELECT *
        FROM candidate_signals
        WHERE owner_user_id = ${authData.userID}
          AND channel = ${channel}
          AND dedupe_key = ${req.dedupe_key}
      `;
    }

    if (existing) {
      return {
        candidate_signal: existing,
        deduped: true,
      };
    }

    const candidateSignal = await db.queryRow<CandidateSignal>`
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
        ${authData.userID},
        ${channel},
        ${sourceType},
        ${req.source_ref ?? null},
        ${req.external_account_ref ?? null},
        ${req.lead_id ?? null},
        ${req.anonymous_id ?? null},
        ${signalType},
        ${req.summary ?? null},
        ${req.raw_text ?? null},
        ${req.actor_display ?? null},
        ${req.actor_handle ?? null},
        ${req.identity_status ?? "unknown"},
        ${req.identity_confidence ?? suggestion.confidence},
        ${req.identity_key_hash ?? null},
        ${suggestion.suggestedEventType},
        ${suggestion.suggestedStage},
        ${suggestion.reason},
        ${suggestion.confidence},
        ${req.dedupe_key ?? null},
        ${JSON.stringify(metadata)},
        ${req.occurred_at ?? new Date().toISOString()},
        now(),
        now()
      )
      RETURNING *
    `;

    if (!candidateSignal) {
      throw APIError.internal("failed to create candidate signal");
    }

    return {
      candidate_signal: candidateSignal,
      deduped: false,
    };
  }
);
