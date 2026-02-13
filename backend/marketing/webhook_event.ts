import { api } from "encore.dev/api";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";
import type { IntentEvent, MarketingLead } from "./types";
import { updateLeadScoring } from "./scoring";
import { checkAndPushToSales } from "./auto_push";
import { autoScoreEvent } from "../intent_scorer/auto_score";

interface WebhookEventRequest {
  lead_email?: string;
  lead_phone?: string;
  event_type: string;
  event_source?: string;
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
  dedupe_key?: string;
  anonymous_id?: string;
}

interface WebhookEventResponse {
  lead: MarketingLead;
  event: IntentEvent;
  auto_pushed: boolean;
}

const VALID_EVENT_TYPES = [
  'post_published',
  'link_clicked',
  'inbound_message',
  'quote_requested',
  'meeting_booked',
  'purchase_made',
  'other'
];

function normalizeEventType(eventType: string): string {
  const normalized = eventType.toLowerCase().trim();
  return VALID_EVENT_TYPES.includes(normalized) ? normalized : 'other';
}

function normalizeMetadata(metadata: JsonObject): JsonObject {
  const normalized: JsonObject = { ...metadata };
  
  if (normalized.utm_medium) {
    normalized.utm_medium = String(normalized.utm_medium).toLowerCase();
  }
  
  if (normalized.reach !== undefined) {
    normalized.reach = Number(normalized.reach) || 0;
  }
  
  if (normalized.clicks !== undefined) {
    normalized.clicks = Number(normalized.clicks) || 0;
  }
  
  return normalized;
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

export const webhookEvent = api<WebhookEventRequest, WebhookEventResponse>(
  { expose: true, method: "POST", path: "/marketing/events" },
  async (req) => {
    const normalizedEventType = normalizeEventType(req.event_type);
    let parsedMetadata: JsonObject = {};
    if (req.metadata) {
      try {
        const parsed = JSON.parse(req.metadata) as JsonObject;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedMetadata = parsed;
        }
      } catch {
        parsedMetadata = {};
      }
    }
    const normalizedMetadata = normalizeMetadata(parsedMetadata);
    const metadataAnonymousId = parseOptionalString(normalizedMetadata.anonymous_id);
    const anonymousId =
      parseOptionalString(req.anonymous_id) ?? metadataAnonymousId;
    if (anonymousId) {
      normalizedMetadata.anonymous_id = anonymousId;
    }
    setMetadataValue(normalizedMetadata, "dedupe_key", parseOptionalString(req.dedupe_key));
    setMetadataValue(normalizedMetadata, "url", parseOptionalString(req.url));
    setMetadataValue(normalizedMetadata, "path", parseOptionalString(req.path));
    setMetadataValue(normalizedMetadata, "referrer", parseOptionalString(req.referrer));
    setMetadataValue(normalizedMetadata, "utm_source", parseOptionalString(req.utm_source));
    setMetadataValue(normalizedMetadata, "utm_medium", parseOptionalString(req.utm_medium));
    setMetadataValue(normalizedMetadata, "utm_campaign", parseOptionalString(req.utm_campaign));
    setMetadataValue(normalizedMetadata, "utm_content", parseOptionalString(req.utm_content));
    setMetadataValue(normalizedMetadata, "gclid", parseOptionalString(req.gclid));
    setMetadataValue(normalizedMetadata, "fbclid", parseOptionalString(req.fbclid));
    setMetadataValue(normalizedMetadata, "msclkid", parseOptionalString(req.msclkid));
    const eventSource = req.event_source || "webhook";
    
    let lead: MarketingLead | null = null;

    if (req.lead_email) {
      lead = await db.queryRow<MarketingLead>`
        SELECT * FROM marketing_leads
        WHERE lower(email) = lower(${req.lead_email})
      `;
    }

    if (!lead && req.lead_phone) {
      lead = await db.queryRow<MarketingLead>`
        SELECT * FROM marketing_leads
        WHERE phone = ${req.lead_phone}
      `;
    }

    // Create lead if not found
    if (!lead) {
      lead = await db.queryRow<MarketingLead>`
        INSERT INTO marketing_leads (
          email,
          phone,
          source_type,
          owner_user_id,
          marketing_stage,
          intent_score,
          created_at,
          updated_at
        ) VALUES (
          ${req.lead_email || null},
          ${req.lead_phone || null},
          'website',
          'system',
          'M1',
          0,
          now(),
          now()
        )
        RETURNING *
      `;
    }

    if (!lead) {
      throw new Error("Failed to find or create lead");
    }

    const rule = await db.queryRow<{ points: number }>`
      SELECT points FROM scoring_rules
      WHERE event_type = ${normalizedEventType} AND is_active = true
    `;

    const eventValue = rule?.points || 0;

    let event: IntentEvent | null = null;
    
    if (req.dedupe_key) {
      event = await db.queryRow<IntentEvent>`
        SELECT * FROM intent_events
        WHERE event_source = ${eventSource} AND dedupe_key = ${req.dedupe_key}
      `;
    }

    if (!event) {
      try {
        event = await db.queryRow<IntentEvent>`
          INSERT INTO intent_events (
            lead_id,
            anonymous_id,
            event_type,
            event_source,
            event_value,
            metadata,
            occurred_at,
            dedupe_key,
            created_at
          ) VALUES (
            ${lead.id},
            ${anonymousId},
            ${normalizedEventType},
            ${eventSource},
            ${eventValue},
            ${JSON.stringify(normalizedMetadata)},
            ${req.occurred_at || new Date().toISOString()},
            ${req.dedupe_key || null},
            now()
          )
          RETURNING *
        `;
      } catch (err: any) {
        if (err.code === '23505') {
          event = await db.queryRow<IntentEvent>`
            SELECT * FROM intent_events
            WHERE event_source = ${eventSource} AND dedupe_key = ${req.dedupe_key}
          `;
        } else {
          throw err;
        }
      }
    }

    if (!event) {
      throw new Error("Failed to create or retrieve event");
    }

    // Auto-score the event using intent scorer
    await autoScoreEvent(event.id);

    // Update scoring
    await updateLeadScoring(lead.id);

    // Refresh lead data
    const updatedLead = await db.queryRow<MarketingLead>`
      SELECT * FROM marketing_leads WHERE id = ${lead.id}
    `;

    // Check auto-push
    const pushResult = await checkAndPushToSales(lead.id);

    return {
      lead: updatedLead!,
      event,
      auto_pushed: pushResult.pushed,
    };
  }
);
