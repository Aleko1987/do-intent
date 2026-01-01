import { api } from "encore.dev/api";
import db from "../db";
import type { IntentEvent, MarketingLead } from "./types";
import { updateLeadScoring } from "./scoring";
import { checkAndPushToSales } from "./auto_push";

interface WebhookEventRequest {
  leadLookup: {
    email?: string;
    phone?: string;
  };
  event_type: string;
  event_source?: string;
  metadata?: Record<string, any>;
  occurred_at?: string;
}

interface WebhookEventResponse {
  lead: MarketingLead;
  event: IntentEvent;
  auto_pushed: boolean;
}

// Generic webhook endpoint for ingesting intent events.
export const webhookEvent = api<WebhookEventRequest, WebhookEventResponse>(
  { expose: true, method: "POST", path: "/marketing/events" },
  async (req) => {
    // Find or create lead
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

    // Get scoring rule
    const rule = await db.queryRow<{ points: number }>`
      SELECT points FROM scoring_rules
      WHERE event_type = ${req.event_type} AND is_active = true
    `;

    const eventValue = rule?.points || 0;

    // Create event
    const event = await db.queryRow<IntentEvent>`
      INSERT INTO intent_events (
        lead_id,
        event_type,
        event_source,
        event_value,
        metadata,
        occurred_at,
        created_at
      ) VALUES (
        ${lead.id},
        ${req.event_type},
        ${req.event_source || "webhook"},
        ${eventValue},
        ${JSON.stringify(req.metadata || {})},
        ${req.occurred_at || new Date().toISOString()},
        now()
      )
      RETURNING *
    `;

    if (!event) {
      throw new Error("Failed to create event");
    }

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
