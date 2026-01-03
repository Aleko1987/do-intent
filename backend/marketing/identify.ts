import { api } from "encore.dev/api";
import db from "../db";
import type { MarketingLead } from "./types";

interface IdentifyRequest {
  anonymous_id: string;
  email: string;
  company_name?: string;
  contact_name?: string;
}

interface IdentifyResponse {
  lead_id: string;
  lead_created: boolean;
  events_attached: number;
}

// POST endpoint for identifying anonymous users
export const identify = api<IdentifyRequest, IdentifyResponse>(
  { expose: true, method: "POST", path: "/marketing/identify" },
  async (req) => {
    // TODO: Add API key check via header when Encore supports it

    // Validate inputs
    if (!req.anonymous_id || typeof req.anonymous_id !== "string") {
      throw new Error("anonymous_id is required and must be a string");
    }
    if (!req.email || typeof req.email !== "string") {
      throw new Error("email is required and must be a string");
    }

    // Normalize email (lowercase, trim)
    const email = req.email.toLowerCase().trim();
    if (!email) {
      throw new Error("email cannot be empty");
    }

    // Find or create lead by email
    let lead = await db.queryRow<MarketingLead>`
      SELECT * FROM marketing_leads
      WHERE lower(email) = ${email}
      LIMIT 1
    `;

    let lead_created = false;

    if (!lead) {
      // Create new lead
      lead = await db.queryRow<MarketingLead>`
        INSERT INTO marketing_leads (
          company_name,
          contact_name,
          email,
          source_type,
          owner_user_id,
          marketing_stage,
          intent_score,
          created_at,
          updated_at
        ) VALUES (
          ${req.company_name || null},
          ${req.contact_name || null},
          ${email},
          'website',
          'system',
          'M1',
          0,
          now(),
          now()
        )
        RETURNING *
      `;

      if (!lead) {
        throw new Error("Failed to create lead");
      }

      lead_created = true;
    } else {
      // Update existing lead with provided info (if not already set)
      if (req.company_name && !lead.company_name) {
        await db.exec`
          UPDATE marketing_leads
          SET company_name = ${req.company_name}, updated_at = now()
          WHERE id = ${lead.id}
        `;
        lead.company_name = req.company_name;
      }
      if (req.contact_name && !lead.contact_name) {
        await db.exec`
          UPDATE marketing_leads
          SET contact_name = ${req.contact_name}, updated_at = now()
          WHERE id = ${lead.id}
        `;
        lead.contact_name = req.contact_name;
      }
    }

    // Find all events with this anonymous_id in metadata that don't have a lead_id yet
    // Actually, since lead_id is NOT NULL, all events have a lead_id
    // So we need to find events where metadata->>'anonymous_id' = req.anonymous_id
    // and update their lead_id to the identified lead

    // First, find events with this anonymous_id
    const eventsToUpdate = await db.queryAll<{ id: string; lead_id: string }>`
      SELECT id, lead_id FROM intent_events
      WHERE metadata->>'anonymous_id' = ${req.anonymous_id}
        AND lead_id != ${lead.id}
    `;

    let events_attached = 0;

    if (eventsToUpdate.length > 0) {
      // Update all matching events to point to the identified lead
      for (const event of eventsToUpdate) {
        await db.exec`
          UPDATE intent_events
          SET lead_id = ${lead.id}
          WHERE id = ${event.id}
        `;
        events_attached++;
      }

      // Recompute rollups for the identified lead (since events were attached)
      // We'll trigger a rollup update by calling the existing function
      // Actually, we can just update the rollup directly
      const now = new Date();
      const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const score7dRow = await db.queryRow<{ total: number | null }>`
        SELECT SUM(isc.score) as total
        FROM intent_events ie
        JOIN intent_scores isc ON isc.intent_event_id = ie.id
        WHERE ie.lead_id = ${lead.id} AND ie.occurred_at >= ${date7d.toISOString()}
      `;

      const score30dRow = await db.queryRow<{ total: number | null }>`
        SELECT SUM(isc.score) as total
        FROM intent_events ie
        JOIN intent_scores isc ON isc.intent_event_id = ie.id
        WHERE ie.lead_id = ${lead.id} AND ie.occurred_at >= ${date30d.toISOString()}
      `;

      const lastEventRow = await db.queryRow<{ occurred_at: string }>`
        SELECT occurred_at FROM intent_events
        WHERE lead_id = ${lead.id}
        ORDER BY occurred_at DESC LIMIT 1
      `;

      const score7d = score7dRow?.total || 0;
      const score30d = score30dRow?.total || 0;
      const lastEventAt = lastEventRow?.occurred_at || null;

      const existing = await db.queryRow<{ lead_id: string }>`
        SELECT lead_id FROM lead_intent_rollups WHERE lead_id = ${lead.id}
      `;

      if (existing) {
        await db.exec`
          UPDATE lead_intent_rollups
          SET score_7d = ${score7d}, score_30d = ${score30d}, last_event_at = ${lastEventAt}, updated_at = now()
          WHERE lead_id = ${lead.id}
        `;
      } else {
        await db.exec`
          INSERT INTO lead_intent_rollups (lead_id, score_7d, score_30d, last_event_at)
          VALUES (${lead.id}, ${score7d}, ${score30d}, ${lastEventAt})
        `;
      }
    }

    return {
      lead_id: lead.id,
      lead_created,
      events_attached,
    };
  }
);

