import { api, APIError, Header } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";

interface DeleteLeadRequest {
  id: string;
  "x-correlation-id"?: Header<"x-correlation-id">;
}

interface DeleteLeadResponse {
  ok: true;
  id: string;
}

interface DeletedLeadRow {
  id: string;
}

export const SOFT_DELETE_LEAD_SQL = `
  UPDATE marketing_leads
  SET deleted_at = now(), updated_at = now()
  WHERE id = $1
    AND owner_user_id = $2
    AND deleted_at IS NULL
  RETURNING id
`;

export function resolveCorrelationId(correlationIdHeader?: string): string {
  const corr = correlationIdHeader?.trim();
  if (corr) {
    return corr;
  }
  return randomUUID();
}

// Soft-deletes a marketing lead for the authenticated owner.
export const deleteLead = api<DeleteLeadRequest, DeleteLeadResponse>(
  { expose: true, method: "DELETE", path: "/marketing/leads/:id", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const corr = resolveCorrelationId(req["x-correlation-id"]);
    const uid = authData.userID;
    const leadId = req.id;

    const deletedLead = await db.rawQueryRow<DeletedLeadRow>(
      SOFT_DELETE_LEAD_SQL,
      leadId,
      uid
    );

    if (!deletedLead) {
      console.info("[marketing.delete_lead] lead not found", {
        corr,
        lead_id: leadId,
        uid,
      });
      throw APIError.notFound("lead not found");
    }

    console.info("[marketing.delete_lead] lead deleted", {
      corr,
      lead_id: leadId,
      uid,
    });

    return { ok: true, id: deletedLead.id };
  }
);
