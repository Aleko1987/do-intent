import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { IntentEvent, MarketingLead, LeadWithEvents } from "./types";

interface GetLeadEventsParams {
  id: string;
}

function pickLeadDisplayName(lead: MarketingLead): string {
  const withLegacyFields = lead as MarketingLead & {
    company?: string | null;
    anonymous_id?: string | null;
  };

  return (
    lead.contact_name?.trim() ||
    withLegacyFields.company?.trim() ||
    lead.company_name?.trim() ||
    lead.email?.trim() ||
    withLegacyFields.anonymous_id?.trim() ||
    lead.id
  );
}

// Retrieves a lead with its recent intent events.
export const getWithEvents = api<GetLeadEventsParams, LeadWithEvents>(
  { expose: true, method: "GET", path: "/marketing/leads/:id/events", auth: true },
  async (params) => {
    const authData = getAuthData()!;
    const lead = await db.queryRow<MarketingLead>`
      SELECT
        id,
        COALESCE(company, '') AS company,
        COALESCE(company_name, '') AS company_name,
        COALESCE(contact_name, '') AS contact_name,
        COALESCE(email, '') AS email,
        phone,
        COALESCE(anonymous_id, '') AS anonymous_id,
        source_type,
        apollo_lead_id,
        marketing_stage,
        intent_score,
        last_signal_at,
        owner_user_id,
        auto_push_enabled,
        sales_customer_id,
        created_at,
        updated_at
      FROM marketing_leads
      WHERE id = ${params.id} AND owner_user_id = ${authData.userID}
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
      display_name: pickLeadDisplayName(lead),
      recent_events: events,
    };
  }
);
