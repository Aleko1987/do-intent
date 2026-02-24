import { api } from "encore.dev/api";
import { resolveMarketingRequestUID, type MarketingAdminAuthRequest } from "./admin_bypass";
import { randomUUID } from "node:crypto";
import { db } from "../db/db";
import type { MarketingLead } from "./types";

interface ListLeadsParams extends MarketingAdminAuthRequest {
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

type DisplayNameSource =
  | "contact_name"
  | "company"
  | "company_name"
  | "email"
  | "anonymous_id"
  | "id";

function resolveLeadDisplayName(lead: MarketingLead): { displayName: string; source: DisplayNameSource } {
  const contactName = lead.contact_name?.trim();
  if (contactName) {
    return { displayName: contactName, source: "contact_name" };
  }

  const company = lead.company?.trim();
  if (company) {
    return { displayName: company, source: "company" };
  }

  const companyName = lead.company_name?.trim();
  if (companyName) {
    return { displayName: companyName, source: "company_name" };
  }

  const email = lead.email?.trim();
  if (email) {
    return { displayName: email, source: "email" };
  }

  const anonymousId = lead.anonymous_id?.trim();
  if (anonymousId) {
    return { displayName: anonymousId, source: "anonymous_id" };
  }

  return { displayName: lead.id, source: "id" };
}

// Lists all marketing leads, optionally filtered by stage.
export const list = api<ListLeadsParams, ListLeadsResponse>(
  { expose: true, method: "GET", path: "/marketing/leads", auth: false },
  async (params) => {
    const uid = resolveMarketingRequestUID(params, "/marketing/leads");
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

    const queryParams: any[] = [uid];

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

    const leadsWithDisplayName = leads.map((lead) => {
      const normalizedLead: MarketingLead = {
        ...lead,
        email: lead.email ?? "",
        contact_name: lead.contact_name ?? "",
        company: lead.company ?? "",
        company_name: lead.company_name ?? "",
      };
      const { displayName } = resolveLeadDisplayName(normalizedLead);

      return {
        ...normalizedLead,
        display_name: displayName,
      };
    });

    const sampleLead = leadsWithDisplayName[0];
    if (sampleLead) {
      const expectedFields = [
        "id",
        "email",
        "contact_name",
        "company",
        "company_name",
        "anonymous_id",
        "marketing_stage",
        "intent_score",
        "last_signal_at",
        "display_name",
      ] as const;

      const sampleResolved = resolveLeadDisplayName(sampleLead);
      console.info("[marketing.list_leads] sample lead display_name resolution", {
        has_leads: leadsWithDisplayName.length > 0,
        fields_present: expectedFields.filter((field) => field in sampleLead),
        has_display_name: !!sampleLead.display_name,
        has_contact_name: !!sampleLead.contact_name?.trim(),
        has_company: !!sampleLead.company?.trim(),
        has_company_name: !!sampleLead.company_name?.trim(),
        has_email: !!sampleLead.email?.trim(),
        display_name_source: sampleResolved.source,
      });
    }

    return { leads: leadsWithDisplayName };
  }
);
