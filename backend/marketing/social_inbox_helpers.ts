import { APIError } from "encore.dev/api";
import type {
  InboxTaskRow,
  NormalizedSocialEventV1,
  SocialActionType,
  SocialPlatform,
} from "./social_inbox_types";

export function parseJsonObject(input: unknown): Record<string, string | number | boolean | null> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
}

export function resolveExecutionUrl(): string {
  const explicit = process.env.DO_SOCIALS_EXECUTE_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const base = process.env.DO_SOCIALS_BASE_URL?.trim();
  if (!base) {
    throw new Error(
      "DO_SOCIALS_BASE_URL or DO_SOCIALS_EXECUTE_URL not configured"
    );
  }
  return `${base.replace(/\/+$/, "")}/api/content-ops/social-execution/execute-task`;
}

export function parseNormalizedSocialEvent(input: unknown): NormalizedSocialEventV1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw APIError.invalidArgument("invalid payload");
  }
  const payload = input as Record<string, unknown>;

  const version = payload.version;
  const sourceEventId = payload.source_event_id;
  const platform = payload.platform;
  const eventType = payload.event_type;
  const actorRef = payload.actor_ref;
  const occurredAt = payload.occurred_at;

  if (version !== "v1") {
    throw APIError.invalidArgument("unsupported version");
  }
  if (typeof sourceEventId !== "string" || !sourceEventId.trim()) {
    throw APIError.invalidArgument("source_event_id is required");
  }
  if (platform !== "facebook" && platform !== "instagram" && platform !== "whatsapp") {
    throw APIError.invalidArgument("unsupported platform");
  }
  if (
    eventType !== "inbound_message" &&
    eventType !== "comment" &&
    eventType !== "reply" &&
    eventType !== "mention" &&
    eventType !== "post_activity" &&
    eventType !== "profile_activity"
  ) {
    throw APIError.invalidArgument("unsupported event_type");
  }
  if (typeof actorRef !== "string" || !actorRef.trim()) {
    throw APIError.invalidArgument("actor_ref is required");
  }
  if (typeof occurredAt !== "string" || !occurredAt.trim()) {
    throw APIError.invalidArgument("occurred_at is required");
  }

  return {
    version: "v1",
    source_event_id: sourceEventId.trim(),
    platform,
    event_type: eventType,
    actor_ref: actorRef.trim(),
    actor_display: typeof payload.actor_display === "string" ? payload.actor_display : null,
    lead_match_confidence:
      typeof payload.lead_match_confidence === "number" ? payload.lead_match_confidence : null,
    occurred_at: occurredAt,
    source_url: typeof payload.source_url === "string" ? payload.source_url : null,
    content_excerpt: typeof payload.content_excerpt === "string" ? payload.content_excerpt : null,
    metadata: parseJsonObject(payload.metadata),
  };
}

export function mapEventTypeToTaskType(
  eventType: NormalizedSocialEventV1["event_type"]
): SocialActionType {
  switch (eventType) {
    case "inbound_message":
      return "reply";
    case "comment":
    case "reply":
    case "mention":
      return "comment";
    case "post_activity":
    case "profile_activity":
      return "like";
    default:
      return "reply";
  }
}

export function resolveDefaultCap(platform: SocialPlatform, actionType: SocialActionType): number {
  const matrix: Record<SocialPlatform, Record<SocialActionType, number>> = {
    facebook: { like: 40, comment: 20, reply: 30, dm: 15 },
    instagram: { like: 40, comment: 20, reply: 30, dm: 15 },
    whatsapp: { like: 0, comment: 0, reply: 40, dm: 40 },
  };
  return matrix[platform][actionType];
}

export function isTaskExecutable(task: InboxTaskRow): boolean {
  return task.status === "approved" || task.status === "failed" || task.status === "blocked";
}

export function isHumanApprovalRequired(actionType: SocialActionType): boolean {
  return actionType === "like" || actionType === "comment" || actionType === "dm";
}
