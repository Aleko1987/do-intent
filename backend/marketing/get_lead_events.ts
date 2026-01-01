import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { IntentEvent, MarketingLead, LeadWithEvents } from "./types";

interface GetLeadEventsParams {
  id: string;
}

// Retrieves a lead with its recent intent events.
export const getWithEvents = api<GetLeadEventsParams, LeadWithEvents>(
  { expose: true, method: "GET", path: "/marketing/leads/:id/events", auth: true },
  async (params) => {
    const authData = getAuthData()!;
    const lead = await db.queryRow<MarketingLead>`
      SELECT * FROM marketing_leads WHERE id = ${params.id} AND owner_user_id = ${authData.userID}
    `;

    if (!lead) {
      throw new Error("Lead not found");
    }

    const events = await db.queryAll<IntentEvent>`
      SELECT * FROM intent_events
      WHERE lead_id = ${params.id}
      ORDER BY occurred_at DESC
      LIMIT 50
    `;

    return {
      ...lead,
      recent_events: events,
    };
  }
);
