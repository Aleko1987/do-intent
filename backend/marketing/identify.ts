import { api, APIError } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db } from "../db/db";
import { resolveIngestApiKey } from "../internal/env_secrets";
import {
  applyCorsHeadersWithOptions,
  parseJsonBody,
} from "../internal/cors";
import { applyCorrelationId } from "../internal/correlation";
import type { MarketingLead } from "./types";

const WEBSITE_ALLOWED_ORIGINS = ["https://earthcurebiodiesel.com"] as const;

function applyWebsiteCors(req: IncomingMessage, res: ServerResponse): void {
  applyCorsHeadersWithOptions(req, res, {
    allowedOrigins: WEBSITE_ALLOWED_ORIGINS,
    allowAnyOriginFallback: false,
  });
}

function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_INGEST_ORIGINS;
  if (!origins) {
    return [];
  }
  return origins.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

interface IdentifyPayload {
  anonymous_id?: string;
  email?: string;
  company_name?: string;
  contact_name?: string;
}

interface IdentifyRequest extends IdentifyPayload {
  "x-do-intent-key"?: string;
  origin?: string;
  referer?: string;
}

interface IdentifyResponse {
  lead_id: string;
  lead_created: boolean;
}

interface PgError extends Error {
  code?: string;
}

type AuthHeaderName = "x-do-intent-key" | "x-ingest-api-key" | "authorization";

function hasValidApiKey(headerKey: string | undefined): boolean {
  const expectedKey = process.env.INGEST_API_KEY?.trim() || resolveIngestApiKey();

  if (!headerKey || !expectedKey) {
    return false;
  }

  return headerKey.trim() === expectedKey;
}

function checkOrigin(origin: string | undefined, referer: string | undefined): void {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) {
    return;
  }

  let hostname: string | null = null;
  if (origin && URL.canParse(origin)) {
    const url = new URL(origin);
    hostname = url.hostname;
  }
  if (!hostname && referer && URL.canParse(referer)) {
    const url = new URL(referer);
    hostname = url.hostname;
  }

  if (!hostname) {
    throw APIError.permissionDenied("API key or origin/referer header required");
  }

  const isAllowed = allowedOrigins.some((allowed) => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowed) {
    throw APIError.permissionDenied(`origin ${hostname} not in allowlist`);
  }
}

async function upsertLead(
  req: IdentifyRequest,
  email: string | null,
  attempt: "full" | "fallback"
): Promise<{ lead: MarketingLead; lead_created: boolean }> {
  const companyName = req.company_name?.trim() || null;
  const company = companyName;
  const contactName = req.contact_name?.trim() || null;
  const anonymousId = req.anonymous_id?.trim() || null;
  const emailProvided = typeof email === "string" && email.length > 0;
  const contactNameProvided = typeof req.contact_name === "string";
  const companyNameProvided = typeof req.company_name === "string";

  const fullUpsertByEmail = db.queryRow<MarketingLead>`
    INSERT INTO marketing_leads (
      company,
      company_name,
      contact_name,
      email,
      anonymous_id,
      source_type,
      owner_user_id,
      marketing_stage,
      intent_score,
      created_at,
      updated_at
    ) VALUES (
      ${company},
      ${companyName},
      ${contactName},
      ${email},
      ${anonymousId},
      'website',
      'system',
      'M1',
      0,
      now(),
      now()
    ) ON CONFLICT (owner_user_id, lower(email)) DO UPDATE
    SET
      email = CASE WHEN ${emailProvided} THEN EXCLUDED.email ELSE marketing_leads.email END,
      company = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company ELSE marketing_leads.company END,
      company_name = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company_name ELSE marketing_leads.company_name END,
      contact_name = CASE WHEN ${contactNameProvided} THEN EXCLUDED.contact_name ELSE marketing_leads.contact_name END,
      anonymous_id = COALESCE(EXCLUDED.anonymous_id, marketing_leads.anonymous_id),
      updated_at = now()
    RETURNING *, (xmax = 0) AS lead_created
  `;

  const fullUpsertByAnonymousId = db.queryRow<MarketingLead>`
    INSERT INTO marketing_leads (
      company,
      company_name,
      contact_name,
      email,
      anonymous_id,
      source_type,
      owner_user_id,
      marketing_stage,
      intent_score,
      created_at,
      updated_at
    ) VALUES (
      ${company},
      ${companyName},
      ${contactName},
      ${email},
      ${anonymousId},
      'website',
      'system',
      'M1',
      0,
      now(),
      now()
    ) ON CONFLICT (anonymous_id) DO UPDATE
    SET
      email = CASE WHEN ${emailProvided} THEN EXCLUDED.email ELSE marketing_leads.email END,
      company = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company ELSE marketing_leads.company END,
      company_name = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company_name ELSE marketing_leads.company_name END,
      contact_name = CASE WHEN ${contactNameProvided} THEN EXCLUDED.contact_name ELSE marketing_leads.contact_name END,
      updated_at = now()
    RETURNING *, (xmax = 0) AS lead_created
  `;

  const fallbackUpsertByEmail = db.queryRow<MarketingLead>`
    INSERT INTO marketing_leads (
      company,
      company_name,
      contact_name,
      email,
      anonymous_id,
      owner_user_id,
      created_at,
      updated_at
    ) VALUES (
      ${company},
      ${companyName},
      ${contactName},
      ${email},
      ${anonymousId},
      'system',
      now(),
      now()
    ) ON CONFLICT (owner_user_id, lower(email)) DO UPDATE
    SET
      email = CASE WHEN ${emailProvided} THEN EXCLUDED.email ELSE marketing_leads.email END,
      company = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company ELSE marketing_leads.company END,
      company_name = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company_name ELSE marketing_leads.company_name END,
      contact_name = CASE WHEN ${contactNameProvided} THEN EXCLUDED.contact_name ELSE marketing_leads.contact_name END,
      anonymous_id = COALESCE(EXCLUDED.anonymous_id, marketing_leads.anonymous_id),
      updated_at = now()
    RETURNING *, (xmax = 0) AS lead_created
  `;

  const fallbackUpsertByAnonymousId = db.queryRow<MarketingLead>`
    INSERT INTO marketing_leads (
      company,
      company_name,
      contact_name,
      email,
      anonymous_id,
      owner_user_id,
      created_at,
      updated_at
    ) VALUES (
      ${company},
      ${companyName},
      ${contactName},
      ${email},
      ${anonymousId},
      'system',
      now(),
      now()
    ) ON CONFLICT (anonymous_id) DO UPDATE
    SET
      email = CASE WHEN ${emailProvided} THEN EXCLUDED.email ELSE marketing_leads.email END,
      company = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company ELSE marketing_leads.company END,
      company_name = CASE WHEN ${companyNameProvided} THEN EXCLUDED.company_name ELSE marketing_leads.company_name END,
      contact_name = CASE WHEN ${contactNameProvided} THEN EXCLUDED.contact_name ELSE marketing_leads.contact_name END,
      updated_at = now()
    RETURNING *, (xmax = 0) AS lead_created
  `;

  const result = attempt === "full"
    ? emailProvided ? await fullUpsertByEmail : await fullUpsertByAnonymousId
    : emailProvided ? await fallbackUpsertByEmail : await fallbackUpsertByAnonymousId;

  if (!result) {
    throw new Error("Failed to upsert lead");
  }

  console.info("[identify] lead persistence", {
    lead_id: result.id,
    has_email: !!result.email,
    has_contact_name: !!result.contact_name,
    has_company: !!result.company,
    has_company_name: !!result.company_name,
  });

  const leadCreatedRaw = (result as MarketingLead & { lead_created?: unknown }).lead_created;
  return {
    lead: result,
    lead_created: leadCreatedRaw === true,
  };
}

async function handleIdentify(req: IdentifyRequest, corr?: string): Promise<IdentifyResponse> {
  try {
    console.info("[identify] Request", {
      has_email: !!req.email,
      anonymous_id: req.anonymous_id,
      has_contact_name: !!req.contact_name,
    });

    const providedApiKey = req["x-do-intent-key"]?.trim();
    const authHeaderNameUsed: AuthHeaderName = "x-do-intent-key";
    if (providedApiKey && hasValidApiKey(providedApiKey)) {
      console.info("[identify] auth check", {
        authHeaderNameUsed,
        authPassed: true,
      });
      // API-key traffic accepted.
    } else if (providedApiKey) {
      console.info("[identify] auth check", {
        authHeaderNameUsed,
        authPassed: false,
      });
      throw APIError.permissionDenied("invalid API key");
    } else {
      console.info("[identify] auth check", {
        authHeaderNameUsed,
        authPassed: false,
      });
      if (!req.origin && !req.referer) {
        throw APIError.permissionDenied("API key or origin/referer header required");
      }
      checkOrigin(req.origin, req.referer);
    }

    if (!req.anonymous_id || typeof req.anonymous_id !== "string") {
      throw APIError.invalidArgument("anonymous_id is required");
    }

    const normalizedEmail = typeof req.email === "string" ? req.email.toLowerCase().trim() : "";
    const email = normalizedEmail.length > 0 ? normalizedEmail : null;

    let upsertResult: { lead: MarketingLead; lead_created: boolean };

    try {
      upsertResult = await upsertLead(req, email, "full");
    } catch (error) {
      const pgError = error as PgError;
      console.warn("[identify] lead upsert warning", {
        corr,
        attempt: "full",
        message: pgError.message,
      });

      if (pgError.code !== "42703") {
        throw error;
      }

      try {
        upsertResult = await upsertLead(req, email, "fallback");
      } catch (fallbackError) {
        const fallbackPgError = fallbackError as PgError;
        console.warn("[identify] lead upsert warning", {
          corr,
          attempt: "fallback",
          message: fallbackPgError.message,
        });
        throw fallbackError;
      }
    }

    return {
      lead_id: upsertResult.lead.id,
      lead_created: upsertResult.lead_created,
    };
  } catch (error) {
    console.error("[identify] Error", error);
    throw error;
  }
}

function getHeaderValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

async function serveIdentify(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startedAt = Date.now();
  const corr = applyCorrelationId(req, res);
  applyWebsiteCors(req, res);
  let errorCode: string | undefined;

  try {
    const payload = await parseJsonBody<IdentifyPayload>(req);
    const apiKeyHeader = getHeaderValue(req, "x-do-intent-key");
    // Keep this explicit so auth logs always name the key header expected by this endpoint.
    const authHeaderNameUsed: AuthHeaderName = "x-do-intent-key";
    console.info("[identify] start", {
      corr,
      method: req.method,
      path: req.url,
      hasAuthHeader: !!apiKeyHeader,
      authHeaderNameUsed,
      bodyShape: {
        hasEmail: !!payload?.email,
        hasAnonymousId: !!payload?.anonymous_id,
        hasContactName: !!payload?.contact_name,
        hasCompanyName: !!payload?.company_name,
        hasLeadId: false,
        hasEventType: false,
      },
    });

    const request: IdentifyRequest = {
      ...payload,
      "x-do-intent-key": apiKeyHeader,
      origin: getHeaderValue(req, "origin"),
      referer: getHeaderValue(req, "referer"),
    };

    const providedApiKey = request["x-do-intent-key"]?.trim();
    if (providedApiKey && !hasValidApiKey(providedApiKey)) {
      console.info("[identify] auth failed", {
        corr,
        reason: "invalid key",
        headerChecked: "x-do-intent-key",
      });
    }
    if (!providedApiKey && !request.origin && !request.referer) {
      console.info("[identify] auth failed", {
        corr,
        reason: "missing key",
        headerChecked: "x-do-intent-key",
      });
    }

    const missing: string[] = [];
    if (!request.anonymous_id || typeof request.anonymous_id !== "string") {
      missing.push("anonymous_id");
    }
    if (missing.length > 0) {
      console.info("[identify] validation failed", {
        corr,
        missing,
      });
    }

    const response = await handleIdentify(request, corr);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(response));
  } catch (error) {
    if (error instanceof APIError) {
      errorCode = error.code;
      const status = error.code === "invalid_argument" ? 400 :
        error.code === "permission_denied" || error.code === "unauthenticated" ? 401 : 500;
      if (status === 401) {
        console.info("[identify] auth failed", {
          corr,
          reason: error.message.includes("invalid API key") ? "invalid key" : "missing key",
          headerChecked: "x-do-intent-key",
        });
      }
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ code: error.code, message: error.message, error: error.message, corr }));

      if (status >= 500) {
        console.error("[identify] server error", {
          corr,
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      return;
    }

    errorCode = "internal";
    const err = error instanceof Error ? error : new Error("unknown error");
    console.error("[identify] server error", {
      corr,
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ code: "internal", message: "Internal Server Error", error: "Internal Server Error", corr }));
  } finally {
    console.info("[identify] end", {
      corr,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
    });
  }
}

export const identify = api.raw(
  { expose: true, method: "POST", path: "/marketing/identify" },
  serveIdentify
);

export const identifyOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/marketing/identify" },
  async (req: IncomingMessage, res: ServerResponse) => {
    applyWebsiteCors(req, res);
    res.statusCode = 204;
    res.end();
  }
);
