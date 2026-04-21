import type { JsonObject } from "../internal/json_types";

export type CandidateSignalChannel =
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "email"
  | "website"
  | "manual_upload";

export type CandidateSignalSourceType =
  | "api"
  | "webhook"
  | "website_tracker"
  | "manual"
  | "upload"
  | "operator";

export type CandidateSignalStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "promoted"
  | "needs_evidence"
  | "reminder_sent"
  | "evidence_attached";

export type CandidateIdentityStatus =
  | "aggregate_only"
  | "deterministic"
  | "probable"
  | "unknown";

export type CandidateSignalEventType =
  | "post_published"
  | "link_clicked"
  | "inbound_message"
  | "quote_requested"
  | "meeting_booked"
  | "purchase_made"
  | "other";

export interface CandidateSignal {
  id: string;
  owner_user_id: string;
  channel: CandidateSignalChannel;
  source_type: CandidateSignalSourceType;
  source_ref: string | null;
  external_account_ref: string | null;
  lead_id: string | null;
  anonymous_id: string | null;
  signal_type: CandidateSignalEventType;
  summary: string | null;
  raw_text: string | null;
  actor_display: string | null;
  actor_handle: string | null;
  identity_status: CandidateIdentityStatus;
  identity_confidence: number;
  identity_key_hash: string | null;
  suggested_event_type: CandidateSignalEventType | null;
  suggested_intent_score: number | null;
  suggested_stage: string | null;
  suggested_reason: string | null;
  suggestion_confidence: number | null;
  status: CandidateSignalStatus;
  promoted_event_id: string | null;
  dedupe_key: string | null;
  metadata: JsonObject;
  occurred_at: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}


export interface CandidateSignalReminder {
  id: string;
  candidate_signal_id: string;
  owner_user_id: string;
  channel: "whatsapp";
  template_text: string;
  delivery_status: "initiated" | "sent" | "replied" | "closed";
  sent_at: string | null;
  responded_at: string | null;
  metadata: JsonObject;
  created_by_user_id: string;
  last_updated_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateSignalEvidence {
  id: string;
  candidate_signal_id: string;
  reminder_id: string | null;
  evidence_type: "screenshot" | "platform_export" | "url" | "manual_note" | "api_payload";
  storage_kind: "external_url" | "internal_path" | "inline";
  evidence_ref: string;
  mime_type: string | null;
  sha256: string | null;
  captured_at: string | null;
  redaction_status: "not_required" | "pending" | "redacted";
  is_sensitive: boolean;
  metadata: JsonObject;
  created_by_user_id: string;
  created_at: string;
}

export interface CandidateSignalReview {
  id: string;
  candidate_signal_id: string;
  reviewer_user_id: string;
  decision: "approve" | "reject" | "edit" | "merge" | "create_lead" | "promote";
  decision_reason: string | null;
  before_payload: JsonObject;
  after_payload: JsonObject;
  applied_event_type: CandidateSignalEventType | null;
  applied_stage: string | null;
  applied_intent_score: number | null;
  applied_lead_id: string | null;
  promoted_event_id: string | null;
  created_at: string;
}

export interface CandidateSignalQueueItem extends CandidateSignal {
  evidence_count: number;
  latest_evidence_ref: string | null;
  reminder_count: number;
  latest_reminder_status: "initiated" | "sent" | "replied" | "closed" | null;
  latest_reminder_sent_at: string | null;
}
