import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { CandidateSignal } from "./candidate_signal_types";
import { createCandidateSignalForOwner } from "./candidate_signal_intake_helpers";

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

// Stores a conservative candidate signal that must pass review before canonical promotion.
export const ingestCandidateSignal = api<IngestCandidateSignalRequest, IngestCandidateSignalResponse>(
  { expose: true, method: "POST", path: "/marketing/candidate-signals", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }
    const result = await createCandidateSignalForOwner({
      ownerUserId: authData.userID,
      channel: req.channel,
      sourceType: req.source_type,
      sourceRef: req.source_ref,
      externalAccountRef: req.external_account_ref,
      leadId: req.lead_id,
      anonymousId: req.anonymous_id,
      signalType: req.signal_type,
      summary: req.summary,
      rawText: req.raw_text,
      actorDisplay: req.actor_display,
      actorHandle: req.actor_handle,
      identityStatus: req.identity_status,
      identityConfidence: req.identity_confidence,
      identityKeyHash: req.identity_key_hash,
      dedupeKey: req.dedupe_key,
      metadata: req.metadata,
      occurredAt: req.occurred_at,
    });

    return {
      candidate_signal: result.candidateSignal,
      deduped: result.deduped,
    };
  }
);
