import type { JsonObject } from "../internal/json_types";

export type SocialPlatform = "facebook" | "instagram" | "whatsapp";
export type SocialEventType =
  | "inbound_message"
  | "comment"
  | "reply"
  | "mention"
  | "post_activity"
  | "profile_activity";
export type SocialActionType = "like" | "comment" | "reply" | "dm";
export type InboxTaskStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executing"
  | "executed"
  | "failed"
  | "blocked"
  | "unsupported";

export interface NormalizedSocialEventV1 {
  version: "v1";
  source_event_id: string;
  platform: SocialPlatform;
  event_type: SocialEventType;
  actor_ref: string;
  actor_display: string | null;
  lead_match_confidence: number | null;
  occurred_at: string;
  source_url: string | null;
  content_excerpt: string | null;
  metadata: JsonObject;
}

export interface ExecuteTaskRequestV1 {
  version: "v1";
  task_id: string;
  idempotency_key: string;
  platform: SocialPlatform;
  action_type: SocialActionType;
  target_ref: string;
  lead_ref: string | null;
  content: string | null;
  metadata: JsonObject;
}

export interface ExecuteTaskResponseV1 {
  version: "v1";
  task_id: string;
  status: "succeeded" | "failed" | "blocked" | "unsupported";
  provider_action_id: string | null;
  occurred_at: string;
  reason_code: string | null;
  reason_message: string | null;
  raw: JsonObject | null;
}

export interface SocialWatchlistRow {
  id: string;
  owner_user_id: string;
  lead_id: string | null;
  platform: SocialPlatform;
  external_profile_ref: string;
  priority: number;
  enabled: boolean;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface InboxTaskRow {
  id: string;
  owner_user_id: string;
  source_event_id: string;
  platform: SocialPlatform;
  event_type: SocialEventType;
  task_type: SocialActionType;
  status: InboxTaskStatus;
  priority: number;
  lead_id: string | null;
  actor_ref: string;
  actor_display: string | null;
  target_ref: string;
  source_url: string | null;
  content_excerpt: string | null;
  suggested_reply: string | null;
  payload_json: JsonObject;
  due_at: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  executed_by_user_id: string | null;
  executed_at: string | null;
  rejected_by_user_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}
