import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";
import type { MarketingLead } from "./types";

interface UpdateLeadRequest {
  id: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  marketing_stage?: string;
  auto_push_enabled?: boolean;
}

// Updates a marketing lead.
export const update = api<UpdateLeadRequest, MarketingLead>(
  { expose: true, method: "PATCH", path: "/marketing/leads/:id", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    const updates: string[] = [];
    const params: any[] = [req.id];
    let paramIndex = 2;

    if (req.company_name !== undefined) {
      updates.push(`company_name = $${paramIndex}`);
      params.push(req.company_name);
      paramIndex++;
    }

    if (req.contact_name !== undefined) {
      updates.push(`contact_name = $${paramIndex}`);
      params.push(req.contact_name);
      paramIndex++;
    }

    if (req.email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(req.email);
      paramIndex++;
    }

    if (req.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(req.phone);
      paramIndex++;
    }

    if (req.marketing_stage !== undefined) {
      updates.push(`marketing_stage = $${paramIndex}`);
      params.push(req.marketing_stage);
      paramIndex++;
    }

    if (req.auto_push_enabled !== undefined) {
      updates.push(`auto_push_enabled = $${paramIndex}`);
      params.push(req.auto_push_enabled);
      paramIndex++;
    }

    updates.push("updated_at = now()");

    params.push(authData.userID);
    const query = `
      UPDATE marketing_leads
      SET ${updates.join(", ")}
      WHERE id = $1 AND owner_user_id = $${paramIndex}
      RETURNING *
    `;

    const lead = await db.rawQueryRow<MarketingLead>(query, ...params);

    if (!lead) {
      throw new Error("Lead not found");
    }

    return lead;
  }
);
