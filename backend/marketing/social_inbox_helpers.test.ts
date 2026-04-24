import { describe, expect, test } from "bun:test";
import {
  mapEventTypeToTaskType,
  parseNormalizedSocialEvent,
  resolveDefaultCap,
} from "./social_inbox_helpers";

describe("social_inbox_helpers", () => {
  test("maps event type to task type", () => {
    expect(mapEventTypeToTaskType("inbound_message")).toBe("reply");
    expect(mapEventTypeToTaskType("mention")).toBe("comment");
    expect(mapEventTypeToTaskType("profile_activity")).toBe("like");
  });

  test("parses normalized social event v1", () => {
    const parsed = parseNormalizedSocialEvent({
      version: "v1",
      source_event_id: "evt_1",
      platform: "instagram",
      event_type: "comment",
      actor_ref: "ig:123",
      actor_display: "Lead Name",
      lead_match_confidence: 0.74,
      occurred_at: "2026-04-24T12:00:00.000Z",
      source_url: "https://example.com/post",
      content_excerpt: "Interested",
      metadata: { owner_user_id: "user_1", ignored: { nope: true } },
    });

    expect(parsed.source_event_id).toBe("evt_1");
    expect(parsed.platform).toBe("instagram");
    expect(parsed.metadata.owner_user_id).toBe("user_1");
    expect((parsed.metadata as any).ignored).toBeUndefined();
  });

  test("default caps are platform aware", () => {
    expect(resolveDefaultCap("whatsapp", "like")).toBe(0);
    expect(resolveDefaultCap("facebook", "dm")).toBeGreaterThan(0);
  });
});
