import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { randomUUID } from "node:crypto";
import { db } from "../db/db";
import type { MarketingLead } from "./types";

interface ListLeadsParams {
  stage?: string;
  limit?: number;
}

interface ListLeadsResponse {
  leads: MarketingLead[];
}

type PgError = Error & {
  code?: string;
  message: string;
};

function pickLeadDisplayName(lead: MarketingLead): string {
  const withLegacyFields = lead as MarketingLead & {
    company?: string | null;
    anonymous_id?: string | null;
  };

  return (
    lead.contact_name?.trim() ||
    withLegacyFields.company?.trim() ||
    lead.company_name?.trim() ||
    lead.email?.trim() ||
    withLegacyFields.anonymous_id?.trim() ||
    lead.id
  );
}

// Lists all marketing leads, optionally filtered by stage.
export const list = api<ListLeadsParams, ListLeadsResponse>(
  { expose: true, method: "GET", path: "/marketing/leads", auth: true },
  async (params) => {
    const authData = getAuthData()!;
    const corr = randomUUID();
    const baseSelectColumns = `
        id,
        COALESCE(company, '') AS company,
        COALESCE(company_name, '') AS company_name,
        COALESCE(contact_name, '') AS contact_name,
        COALESCE(email, '') AS email,
        phone,
        COALESCE(anonymous_id, '') AS anonymous_id,
        source_type,
        marketing_stage,
        intent_score,
        last_signal_at,
        owner_user_id,
        auto_push_enabled,
        sales_customer_id,
        created_at,
        updated_at
    `;

    const buildQuery = (includeApolloLeadId: boolean): string => {
      const selectColumns = includeApolloLeadId
        ? `${baseSelectColumns.trimEnd()},\n        apollo_lead_id`
        : baseSelectColumns;

      let query = `
      SELECT
${selectColumns}
      FROM marketing_leads
      WHERE owner_user_id = $1
    `;

      if (params.stage) {
        query += ` AND marketing_stage = $2`;
      }

      query += ` ORDER BY last_signal_at DESC NULLS LAST, created_at DESC`;

      if (params.limit) {
        const limitParamIndex = params.stage ? 3 : 2;
        query += ` LIMIT $${limitParamIndex}`;
      }

      return query;
    };

    const queryParams: any[] = [authData.userID];

    if (params.stage) {
      queryParams.push(params.stage);
    }

    if (params.limit) {
      queryParams.push(params.limit);
    }

    let leads: MarketingLead[];

    try {
      leads = await db.rawQueryAll<MarketingLead>(buildQuery(true), ...queryParams);
    } catch (error) {
      const pgError = error as PgError;
      const missingApolloLeadId =
        pgError.code === "42703" && pgError.message.toLowerCase().includes("apollo_lead_id");
      if (!missingApolloLeadId) {
        throw error;
      }

      console.warn("[marketing.list_leads] missing optional column, retrying query", {
        corr,
        code: pgError.code,
      });

      leads = await db.rawQueryAll<MarketingLead>(buildQuery(false), ...queryParams);
    }

    const leadsWithDisplayName = leads.map((lead) => ({
      ...lead,
      display_name: pickLeadDisplayName(lead),
    }));

    return { leads: leadsWithDisplayName };
  }
);
