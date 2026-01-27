import { api } from "encore.dev/api";
import { db } from "../db/db";
import type { IntentEvent, MarketingLead } from "./types";
import { updateLeadScoring } from "./scoring";
import { checkAndPushToSales } from "./auto_push";
import { autoScoreEvent } from "../intent_scorer/auto_score";

interface WebhookEventRequest {
  leadLookup: {
    email?: string;
    phone?: string;
  };
  event_type: string;
  event_source?: string;
  metadata?: Record<string, any>;
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

function normalizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...metadata };
  
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

export const webhookEvent = api<WebhookEventRequest, WebhookEventResponse>(
  { expose: true, method: "POST", path: "/marketing/events" },
  async (req) => {
    const normalizedEventType = normalizeEventType(req.event_type);
    const normalizedMetadata = normalizeMetadata(req.metadata || {});
    const metadataAnonymousId = parseOptionalString(normalizedMetadata.anonymous_id);
    const anonymousId =
      parseOptionalString(req.anonymous_id) ?? metadataAnonymousId;
    if (anonymousId) {
      normalizedMetadata.anonymous_id = anonymousId;
    }
    const eventSource = req.event_source || "webhook";
    
    let lead: MarketingLead | null = null;

    if (req.leadLookup.email) {
      lead = await db.queryRow<MarketingLead>`
        SELECT * FROM marketing_leads
        WHERE lower(email) = lower(${req.leadLookup.email})
      `;
    }

    if (!lead && req.leadLookup.phone) {
      lead = await db.queryRow<MarketingLead>`
        SELECT * FROM marketing_leads
        WHERE phone = ${req.leadLookup.phone}
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
          ${req.leadLookup.email || null},
          ${req.leadLookup.phone || null},
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
