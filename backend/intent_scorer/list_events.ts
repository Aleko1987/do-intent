import { api } from "encore.dev/api";
import { db } from "../db/db";
import type { EventFilters, ScoredEvent } from "./types";

interface ListEventsResponse {
  events: ScoredEvent[];
  total: number;
}

export const listEvents = api<EventFilters, ListEventsResponse>(
  { method: "POST", path: "/intent-scorer/events", expose: true },
  async (filters): Promise<ListEventsResponse> => {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramCount = 0;

    if (filters.source) {
      paramCount++;
      whereConditions.push(`ie.event_source = $${paramCount}`);
      params.push(filters.source);
    }

    if (filters.event_type) {
      paramCount++;
      whereConditions.push(`ie.event_type = $${paramCount}`);
      params.push(filters.event_type);
    }

    if (filters.lead_id) {
      paramCount++;
      whereConditions.push(`ie.lead_id = $${paramCount}`);
      params.push(filters.lead_id);
    }

    if (filters.from_date) {
      paramCount++;
      whereConditions.push(`ie.occurred_at >= $${paramCount}`);
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      paramCount++;
      whereConditions.push(`ie.occurred_at <= $${paramCount}`);
      params.push(filters.to_date);
    }

    if (filters.search) {
      paramCount++;
      whereConditions.push(`ie.metadata::text ILIKE $${paramCount}`);
      params.push(`%${filters.search}%`);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(" AND ")}` 
      : "";

    const countQuery = `
      SELECT COUNT(*) as count
      FROM intent_events ie
      ${whereClause}
    `;

    const countRow = await db.rawQueryRow<{ count: string }>(countQuery, ...params);
    const total = parseInt(countRow?.count || "0", 10);

    const dataQuery = `
      SELECT 
        ie.id as event_id,
        ie.lead_id,
        ie.event_type,
        ie.event_source,
        ie.metadata,
        ie.occurred_at,
        COALESCE(isc.score, 0) as score,
        COALESCE(isc.confidence, 0) as confidence,
        COALESCE(isc.reasons, '[]'::jsonb) as reasons
      FROM intent_events ie
      LEFT JOIN intent_scores isc ON isc.intent_event_id = ie.id
      ${whereClause}
      ORDER BY ie.occurred_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);

    const events = await db.rawQueryAll<ScoredEvent>(dataQuery, ...params);

    return {
      events: events.map((e) => ({
        ...e,
        reasons: Array.isArray(e.reasons) ? e.reasons : [],
      })),
      total,
    };
  }
);
