import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { IntentEvent, MarketingLead } from "./types";
import { updateLeadScoring } from "./scoring";
import { checkAndPushToSales } from "./auto_push";
import { autoScoreEvent } from "../intent_scorer/auto_score";

interface CreateEventRequest {
  id: string;
  event_type: string;
  event_source: string;
  anonymous_id?: string;
  dedupe_key?: string;
  url?: string;
  path?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  metadata?: string;
  occurred_at?: string;
}

interface CreateEventResponse {
  event: IntentEvent;
  score_updated: boolean;
  auto_pushed: boolean;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function setMetadataValue(
  metadata: JsonObject,
  key: string,
  value: string | null
): void {
  if (value === null) return;
  const existing = metadata[key];
  if (existing === undefined || existing === null || existing === "") {
    metadata[key] = value;
  }
}

// Creates an intent event for a lead and triggers scoring.
export const createEvent = api<CreateEventRequest, CreateEventResponse>(
  { expose: true, method: "POST", path: "/marketing/leads/:id/events", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    let metadata: JsonObject = {};
    if (req.metadata) {
      try {
        const parsed = JSON.parse(req.metadata) as JsonObject;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          metadata = { ...parsed };
        }
      } catch {
        metadata = {};
      }
    }
    const metadataAnonymousId = parseOptionalString(metadata.anonymous_id);
    const anonymousId = parseOptionalString(req.anonymous_id) ?? metadataAnonymousId;
    if (anonymousId) {
      metadata.anonymous_id = anonymousId;
    }
    const dedupeKey = parseOptionalString(req.dedupe_key);
    setMetadataValue(metadata, "dedupe_key", dedupeKey);
    setMetadataValue(metadata, "url", parseOptionalString(req.url));
    setMetadataValue(metadata, "path", parseOptionalString(req.path));
    setMetadataValue(metadata, "referrer", parseOptionalString(req.referrer));
    setMetadataValue(metadata, "utm_source", parseOptionalString(req.utm_source));
    setMetadataValue(metadata, "utm_medium", parseOptionalString(req.utm_medium));
    setMetadataValue(metadata, "utm_campaign", parseOptionalString(req.utm_campaign));
    setMetadataValue(metadata, "utm_content", parseOptionalString(req.utm_content));
    setMetadataValue(metadata, "gclid", parseOptionalString(req.gclid));
    setMetadataValue(metadata, "fbclid", parseOptionalString(req.fbclid));
    setMetadataValue(metadata, "msclkid", parseOptionalString(req.msclkid));
    
    const lead = await db.queryRow<MarketingLead>`
      SELECT * FROM marketing_leads WHERE id = ${req.id} AND owner_user_id = ${authData.userID}
    `;
    
    if (!lead) {
      throw new Error("Lead not found");
    }
    // Get scoring rule for this event type
    const rule = await db.queryRow<{ points: number }>`
      SELECT points FROM scoring_rules
      WHERE event_type = ${req.event_type} AND is_active = true
    `;

    const eventValue = rule?.points || 0;

    // Create the event
    const event = await db.queryRow<IntentEvent>`
      INSERT INTO intent_events (
        lead_id,
        anonymous_id,
        event_type,
        event_source,
        event_value,
        dedupe_key,
        metadata,
        occurred_at,
        created_at
      ) VALUES (
        ${req.id},
        ${anonymousId},
        ${req.event_type},
        ${req.event_source},
        ${eventValue},
        ${dedupeKey},
        ${JSON.stringify(metadata)},
        ${req.occurred_at || new Date().toISOString()},
        now()
      )
      RETURNING *
    `;

    if (!event) {
      throw new Error("Failed to create event");
    }

    // Auto-score the event using intent scorer
    await autoScoreEvent(event.id);

    // Update lead scoring
    await updateLeadScoring(req.id);

    // Check if lead should be auto-pushed to sales
    const pushResult = await checkAndPushToSales(req.id);

    return {
      event,
      score_updated: true,
      auto_pushed: pushResult.pushed,
    };
  }
);
