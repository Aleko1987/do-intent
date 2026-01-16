import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { IntentEvent, MarketingLead } from "./types";
import { updateLeadScoring } from "./scoring";
import { checkAndPushToSales } from "./auto_push";
import { autoScoreEvent } from "../intent_scorer/auto_score";

interface CreateEventRequest {
  id: string;
  event_type: string;
  event_source: string;
  metadata?: Record<string, any>;
  occurred_at?: string;
}

interface CreateEventResponse {
  event: IntentEvent;
  score_updated: boolean;
  auto_pushed: boolean;
}

// Creates an intent event for a lead and triggers scoring.
export const createEvent = api<CreateEventRequest, CreateEventResponse>(
  { expose: true, method: "POST", path: "/marketing/leads/:id/events", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    
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
        event_type,
        event_source,
        event_value,
        metadata,
        occurred_at,
        created_at
      ) VALUES (
        ${req.id},
        ${req.event_type},
        ${req.event_source},
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
