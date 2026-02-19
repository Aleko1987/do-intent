import { api, APIError } from "encore.dev/api";
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
  stage_id?: string;
  status?: string;
  auto_push_enabled?: boolean;
}

const VALID_MARKETING_STAGES = new Set(["M1", "M2", "M3", "M4", "M5"]);

function normalizeMarketingStage(req: UpdateLeadRequest): string | undefined {
  return req.marketing_stage ?? req.stage_id ?? req.status;
}

// Updates a marketing lead.
export const update = api<UpdateLeadRequest, MarketingLead>(
  { expose: true, method: "PATCH", path: "/marketing/leads/:id", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const updates: string[] = [];
    const params: unknown[] = [req.id];
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

    const requestedStage = normalizeMarketingStage(req);
    if (requestedStage !== undefined) {
      if (!VALID_MARKETING_STAGES.has(requestedStage)) {
        throw APIError.invalidArgument(
          "marketing_stage must be one of: M1, M2, M3, M4, M5"
        );
      }

      updates.push(`marketing_stage = $${paramIndex}`);
      params.push(requestedStage);
      paramIndex++;
    }

    if (req.auto_push_enabled !== undefined) {
      updates.push(`auto_push_enabled = $${paramIndex}`);
      params.push(req.auto_push_enabled);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument(
        "no updatable fields provided in request body"
      );
    }

    updates.push("updated_at = now()");

    params.push(authData.userID);
    const query = `
      UPDATE marketing_leads
      SET ${updates.join(", ")}
      WHERE id = $1 AND owner_user_id = $${paramIndex}
      RETURNING *
    `;

    let lead: MarketingLead | null;
    try {
      lead = await db.rawQueryRow<MarketingLead>(query, ...params);
    } catch (error) {
      console.error("Failed to update marketing lead", {
        leadId: req.id,
        userId: authData.userID,
        error,
      });
      throw APIError.internal("failed to update lead");
    }

    if (!lead) {
      throw APIError.notFound("lead not found");
    }

    return lead;
  }
);
