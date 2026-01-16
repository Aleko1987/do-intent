import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { MarketingLead } from "./types";

interface ListLeadsParams {
  stage?: string;
  limit?: number;
}

interface ListLeadsResponse {
  leads: MarketingLead[];
}

// Lists all marketing leads, optionally filtered by stage.
export const list = api<ListLeadsParams, ListLeadsResponse>(
  { expose: true, method: "GET", path: "/marketing/leads", auth: true },
  async (params) => {
    const authData = getAuthData()!;
    let query = `
      SELECT * FROM marketing_leads
      WHERE owner_user_id = $1
    `;

    const queryParams: any[] = [authData.userID];

    if (params.stage) {
      queryParams.push(params.stage);
      query += ` AND marketing_stage = $${queryParams.length}`;
    }

    query += ` ORDER BY last_signal_at DESC NULLS LAST, created_at DESC`;

    if (params.limit) {
      queryParams.push(params.limit);
      query += ` LIMIT $${queryParams.length}`;
    }

    const leads = await db.rawQueryAll<MarketingLead>(query, ...queryParams);

    return { leads };
  }
);
