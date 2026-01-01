import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { MarketingLead } from "./types";

interface CreateLeadRequest {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source_type: string;
  apollo_lead_id?: string;
}

// Creates a new marketing lead.
export const create = api<CreateLeadRequest, MarketingLead>(
  { expose: true, method: "POST", path: "/marketing/leads", auth: true },
  async (req) => {
    const authData = getAuthData()!;
    const lead = await db.queryRow<MarketingLead>`
      INSERT INTO marketing_leads (
        company_name,
        contact_name,
        email,
        phone,
        source_type,
        apollo_lead_id,
        owner_user_id,
        marketing_stage,
        intent_score,
        created_at,
        updated_at
      ) VALUES (
        ${req.company_name || null},
        ${req.contact_name || null},
        ${req.email || null},
        ${req.phone || null},
        ${req.source_type},
        ${req.apollo_lead_id || null},
        ${authData.userID},
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

    return lead;
  }
);
