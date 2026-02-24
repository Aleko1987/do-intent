import { api, APIError } from "encore.dev/api";
import { db } from "../db/db";
import { resolveMarketingRequestUID, type MarketingAdminAuthRequest } from "./admin_bypass";

interface DeleteLeadRequest extends MarketingAdminAuthRequest {
  id: string;
}

interface DeleteLeadResponse {
  ok: true;
  deletedId: string;
}

// Deletes a marketing lead.
export const remove = api<DeleteLeadRequest, DeleteLeadResponse>(
  { expose: true, method: "DELETE", path: "/marketing/leads/:id", auth: false },
  async (req) => {
    const uid = resolveMarketingRequestUID(req, "/marketing/leads/:id");

    const lead = await db.rawQueryRow<{ id: string }>(
      `
        DELETE FROM marketing_leads
        WHERE id = ${req.id} AND owner_user_id = ${uid}
        RETURNING id
      `
    );

    if (!lead) {
      throw APIError.notFound("lead not found");
    }

    return {
      ok: true,
      deletedId: lead.id,
    };
  }
);
