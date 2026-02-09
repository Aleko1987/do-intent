import { api } from "encore.dev/api";
import { db } from "../db/db";
import type { LeadTopSignalsRequest, LeadTopSignalsResponse, TopSignalEvent } from "./types";

export const getLeadTopSignals = api<LeadTopSignalsRequest, LeadTopSignalsResponse>(
  { method: "POST", path: "/intent-scorer/lead-top-signals", expose: true },
  async (req): Promise<LeadTopSignalsResponse> => {
    const limit = req.limit || 10;

    const query = `
      SELECT 
        ie.id as event_id,
        ie.event_type,
        ie.event_source,
        ie.occurred_at,
        isc.score,
        isc.reasons
      FROM intent_events ie
      JOIN intent_scores isc ON ie.id = isc.intent_event_id
      WHERE ie.lead_id = $1
        AND ie.occurred_at >= NOW() - INTERVAL '30 days'
      ORDER BY isc.score DESC, ie.occurred_at DESC
      LIMIT $2
    `;

    const result = await db.rawQueryAll<TopSignalEvent>(query, req.lead_id, limit);

    return {
      lead_id: req.lead_id,
      events: result
    };
  }
);
