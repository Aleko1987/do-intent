import { api } from "encore.dev/api";
import db from "../db";
import type { LeadTrendRequest, LeadTrendResponse, DailyScoreBucket } from "./types";

export const getLeadTrend = api(
  { method: "POST", path: "/intent-scorer/lead-trend", expose: true },
  async (req: LeadTrendRequest): Promise<LeadTrendResponse> => {
    const days = req.days || 14;

    const query = `
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '1 day' * $2,
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date as date
      ),
      daily_scores AS (
        SELECT 
          ie.occurred_at::date as date,
          COALESCE(SUM(isc.score), 0) as total_score
        FROM intent_events ie
        JOIN intent_scores isc ON ie.id = isc.intent_event_id
        WHERE ie.lead_id = $1
          AND ie.occurred_at >= CURRENT_DATE - INTERVAL '1 day' * $2
        GROUP BY ie.occurred_at::date
      )
      SELECT 
        ds.date::text,
        COALESCE(dsc.total_score, 0) as total_score
      FROM date_series ds
      LEFT JOIN daily_scores dsc ON ds.date = dsc.date
      ORDER BY ds.date ASC
    `;

    const result = await db.rawQueryAll<DailyScoreBucket>(query, req.lead_id, days);

    return {
      lead_id: req.lead_id,
      buckets: result
    };
  }
);
