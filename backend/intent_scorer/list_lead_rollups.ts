import { api } from "encore.dev/api";
import { db } from "../db/db";
import type { LeadRollupsRequest, LeadRollupsResponse, LeadRollupWithLead } from "./types";

export const listLeadRollups = api<LeadRollupsRequest, LeadRollupsResponse>(
  { method: "POST", path: "/intent-scorer/lead-rollups", expose: true },
  async (req): Promise<LeadRollupsResponse> => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;
    const search = req.search?.trim() || "";

    let countQuery = `
      SELECT COUNT(*)::int as total
      FROM lead_intent_rollups r
      JOIN marketing_leads l ON r.lead_id = l.id
    `;
    let dataQuery = `
      SELECT 
        r.lead_id,
        l.company_name,
        l.contact_name,
        l.email,
        r.score_7d,
        r.score_30d,
        r.last_event_at,
        (
          SELECT ie.event_type
          FROM intent_events ie
          JOIN intent_scores isc ON ie.id = isc.intent_event_id
          WHERE ie.lead_id = r.lead_id
            AND ie.occurred_at >= NOW() - INTERVAL '30 days'
          ORDER BY isc.score DESC
          LIMIT 1
        ) as top_signal
      FROM lead_intent_rollups r
      JOIN marketing_leads l ON r.lead_id = l.id
    `;

    const params: any[] = [];

    if (search) {
      const whereClause = `
        WHERE (
          l.company_name ILIKE $1 
          OR l.contact_name ILIKE $1 
          OR l.email ILIKE $1
        )
      `;
      countQuery += whereClause;
      dataQuery += whereClause;
      params.push(`%${search}%`);
    }

    dataQuery += ` ORDER BY r.score_7d DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const countParams = search ? [`%${search}%`] : [];
    const [countResult, dataResult] = await Promise.all([
      db.rawQueryAll<{ total: number }>(countQuery, ...countParams),
      db.rawQueryAll<LeadRollupWithLead>(dataQuery, ...params)
    ]);

    return {
      leads: dataResult,
      total: countResult[0]?.total || 0
    };
  }
);
