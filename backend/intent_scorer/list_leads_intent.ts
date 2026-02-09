import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";

export interface LeadIntentListItem {
  lead_id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  score_7d: number;
  score_30d: number;
  last_activity: string | null;
  top_intent_signal: {
    event_type: string;
    score: number;
    occurred_at: string;
  } | null;
}

interface ListLeadsIntentParams {
  min_score_7d?: number;
  min_score_30d?: number;
  activity_days?: number; // Filter by last activity within N days
  search?: string; // Search company/contact/email
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: string;
}

interface ListLeadsIntentResponse {
  leads: LeadIntentListItem[];
  total: number;
}

async function executeLeadsQuery(
  params: ListLeadsIntentParams,
  ownerUserId?: string
): Promise<ListLeadsIntentResponse> {
  const limit = params.limit || 50;
  const offset = params.offset || 0;
  const sortByRaw = (params.sort_by || "score_7d").toLowerCase();
  const sortOrderRaw = (params.sort_order || "desc").toLowerCase();
  const sortBy =
    sortByRaw === "score_30d" || sortByRaw === "last_activity"
      ? sortByRaw
      : "score_7d";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";

  let whereConditions: string[] = [];
  let paramsList: any[] = [];
  let paramCount = 0;

  if (ownerUserId) {
    paramCount++;
    whereConditions.push(`ml.owner_user_id = $${paramCount}`);
    paramsList.push(ownerUserId);
  }

    if (params.min_score_7d !== undefined) {
      paramCount++;
      whereConditions.push(`COALESCE(lir.score_7d, 0) >= $${paramCount}`);
      paramsList.push(params.min_score_7d);
    }

    if (params.min_score_30d !== undefined) {
      paramCount++;
      whereConditions.push(`COALESCE(lir.score_30d, 0) >= $${paramCount}`);
      paramsList.push(params.min_score_30d);
    }

    if (params.activity_days !== undefined) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - params.activity_days);
      paramCount++;
      whereConditions.push(`COALESCE(lir.last_event_at, ml.created_at) >= $${paramCount}`);
      paramsList.push(cutoffDate.toISOString());
    }

    if (params.search) {
      paramCount++;
      whereConditions.push(
        `(ml.company_name ILIKE $${paramCount} OR ml.contact_name ILIKE $${paramCount} OR ml.email ILIKE $${paramCount})`
      );
      paramsList.push(`%${params.search}%`);
    }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // Count query
  const countQuery = `
    SELECT COUNT(DISTINCT ml.id) as count
    FROM marketing_leads ml
    LEFT JOIN lead_intent_rollups lir ON lir.lead_id = ml.id
    ${whereClause}
  `;

  const countRow = await db.rawQueryRow<{ count: string }>(countQuery, ...paramsList);
  const total = parseInt(countRow?.count || "0", 10);

  // Main query with top intent signal subquery
  const orderByClause = 
    sortBy === "score_7d" 
      ? `COALESCE(lir.score_7d, 0) ${sortOrder.toUpperCase()}`
      : sortBy === "score_30d"
      ? `COALESCE(lir.score_30d, 0) ${sortOrder.toUpperCase()}`
      : `COALESCE(lir.last_event_at, ml.created_at) ${sortOrder.toUpperCase()} NULLS LAST`;

  const dataQuery = `
    WITH lead_scores AS (
      SELECT 
        ml.id as lead_id,
        ml.company_name,
        ml.contact_name,
        ml.email,
        COALESCE(lir.score_7d, 0) as score_7d,
        COALESCE(lir.score_30d, 0) as score_30d,
        COALESCE(lir.last_event_at, ml.created_at) as last_activity
      FROM marketing_leads ml
      LEFT JOIN lead_intent_rollups lir ON lir.lead_id = ml.id
      ${whereClause}
    ),
    top_signals AS (
      SELECT DISTINCT ON (ie.lead_id)
        ie.lead_id,
        ie.event_type,
        COALESCE(isc.score, 0) as score,
        ie.occurred_at
      FROM intent_events ie
      LEFT JOIN intent_scores isc ON isc.intent_event_id = ie.id
      WHERE ie.lead_id IN (SELECT lead_id FROM lead_scores)
        AND COALESCE(isc.score, 0) > 0
      ORDER BY ie.lead_id, COALESCE(isc.score, 0) DESC, ie.occurred_at DESC
    )
    SELECT 
      ls.lead_id,
      ls.company_name,
      ls.contact_name,
      ls.email,
      ls.score_7d,
      ls.score_30d,
      ls.last_activity,
      CASE 
        WHEN ts.lead_id IS NOT NULL THEN
          json_build_object(
            'event_type', ts.event_type,
            'score', ts.score,
            'occurred_at', ts.occurred_at
          )
        ELSE NULL
      END as top_intent_signal
    FROM lead_scores ls
    LEFT JOIN top_signals ts ON ts.lead_id = ls.lead_id
    ORDER BY ${orderByClause}
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;

  paramsList.push(limit, offset);

  const leads = await db.rawQueryAll<LeadIntentListItem>(dataQuery, ...paramsList);

  return {
    leads: leads.map((lead) => ({
      ...lead,
      top_intent_signal: lead.top_intent_signal as any,
    })),
    total,
  };
}

export const listLeadsIntent = api<ListLeadsIntentParams, ListLeadsIntentResponse>(
  { expose: true, method: "POST", path: "/intent-scorer/leads", auth: true },
  async (params) => {
    const authData = getAuthData()!;
    return executeLeadsQuery(params, authData.userID);
  }
);

export const listLeadsIntentPublic = api<ListLeadsIntentParams, ListLeadsIntentResponse>(
  { expose: true, method: "POST", path: "/intent-scorer/leads/public", auth: false },
  async (params) => {
    const isEnabled = (process.env.DISABLE_AUTH_FOR_INTENT_LIST || "").toLowerCase() === "true";
    
    if (!isEnabled) {
      throw APIError.notFound(
        "Public endpoint is disabled. Set DISABLE_AUTH_FOR_INTENT_LIST=true to enable."
      );
    }

    return executeLeadsQuery(params);
  }
);

