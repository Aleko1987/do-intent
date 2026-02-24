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

function hasNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
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
  const ownerUserId = process.env.WEBSITE_OWNER_USER_ID?.trim() || "system";
  const companyName = req.company_name?.trim() || null;
  const company = companyName;
  const contactName = req.contact_name?.trim() || null;
  const anonymousId = req.anonymous_id?.trim() || null;
  const emailProvided = email !== null;
  const contactNameProvided = contactName !== null;
  const companyNameProvided = companyName !== null;

  const findExistingLead = emailProvided
    ? db.queryRow<MarketingLead>`
      SELECT *
      FROM marketing_leads
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `
    : db.queryRow<MarketingLead>`
      SELECT *
      FROM marketing_leads
      WHERE owner_user_id = ${ownerUserId}
        AND anonymous_id = ${anonymousId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

  const existingAnonymousLead = emailProvided && anonymousId
    ? await db.queryRow<MarketingLead>`
      SELECT *
      FROM marketing_leads
      WHERE owner_user_id = ${ownerUserId}
        AND anonymous_id = ${anonymousId}
      ORDER BY created_at DESC
      LIMIT 1
    `
    : null;

  const existingLead = await findExistingLead;

  const performPersistence = async (): Promise<{ lead: MarketingLead; lead_created: boolean }> => {
    if (existingLead) {
      const updatedLead = await db.queryRow<MarketingLead>`
        UPDATE marketing_leads
        SET
          owner_user_id = ${ownerUserId},
          email = COALESCE(${email}, email),
          contact_name = COALESCE(${contactName}, contact_name),
          company_name = COALESCE(${companyName}, company_name),
          company = COALESCE(${companyName}, company),
          anonymous_id = COALESCE(${anonymousId}, anonymous_id),
          source_type = COALESCE(source_type, 'website'),
          source = COALESCE(source, 'website'),
          last_signal_at = now(),
          updated_at = now()
        WHERE id = ${existingLead.id}
        RETURNING *
      `;

      if (!updatedLead) {
        throw new Error("Failed to update lead");
      }

      return { lead: updatedLead, lead_created: false };
    }

    let insertedLead: MarketingLead | null = null;
    try {
      insertedLead = await db.queryRow<MarketingLead>`
        INSERT INTO marketing_leads (
          company,
          company_name,
          contact_name,
          email,
          anonymous_id,
          source_type,
          source,
          owner_user_id,
          marketing_stage,
          intent_score,
          last_signal_at,
          created_at,
          updated_at
        ) VALUES (
          ${company},
          ${companyName},
          ${contactName},
          ${email},
          ${anonymousId},
          'website',
          'website',
          ${ownerUserId},
          'M1',
          0,
          now(),
          now(),
          now()
        )
        RETURNING *
      `;
    } catch (error) {
      const pgError = error as PgError;
      if (!emailProvided || pgError.code !== "23505") {
        throw error;
      }

      const duplicateLead = await db.queryRow<MarketingLead>`
        SELECT *
        FROM marketing_leads
        WHERE lower(email) = lower(${email})
        LIMIT 1
      `;

      if (!duplicateLead) {
        throw error;
      }

      insertedLead = await db.queryRow<MarketingLead>`
        UPDATE marketing_leads
        SET
          owner_user_id = ${ownerUserId},
          email = COALESCE(${email}, email),
          contact_name = COALESCE(${contactName}, contact_name),
          company_name = COALESCE(${companyName}, company_name),
          company = COALESCE(${companyName}, company),
          anonymous_id = COALESCE(${anonymousId}, anonymous_id),
          source_type = COALESCE(source_type, 'website'),
          source = COALESCE(source, 'website'),
          last_signal_at = now(),
          updated_at = now()
        WHERE id = ${duplicateLead.id}
        RETURNING *
      `;

      if (!insertedLead) {
        throw new Error("Failed to update lead after duplicate email insert");
      }

      return { lead: insertedLead, lead_created: false };
    }

    if (!insertedLead) {
      throw new Error("Failed to insert lead");
    }

    return { lead: insertedLead, lead_created: true };
  };

  const result = attempt === "full"
    ? await performPersistence()
    : await performPersistence();

  let persistedLead = result.lead;
  if (emailProvided && existingAnonymousLead && existingAnonymousLead.id !== result.lead.id) {
    const mergedLead = await db.queryRow<MarketingLead>`
      UPDATE marketing_leads
      SET
        company = COALESCE(marketing_leads.company, ${existingAnonymousLead.company ?? null}),
        company_name = COALESCE(marketing_leads.company_name, ${existingAnonymousLead.company_name ?? null}),
        contact_name = COALESCE(marketing_leads.contact_name, ${existingAnonymousLead.contact_name ?? null}),
        phone = COALESCE(marketing_leads.phone, ${existingAnonymousLead.phone ?? null}),
        anonymous_id = COALESCE(marketing_leads.anonymous_id, ${existingAnonymousLead.anonymous_id ?? null}),
        source_type = COALESCE(marketing_leads.source_type, ${existingAnonymousLead.source_type ?? null}),
        apollo_lead_id = COALESCE(marketing_leads.apollo_lead_id, ${existingAnonymousLead.apollo_lead_id ?? null}),
        marketing_stage = COALESCE(marketing_leads.marketing_stage, ${existingAnonymousLead.marketing_stage ?? null}),
        intent_score = COALESCE(marketing_leads.intent_score, ${existingAnonymousLead.intent_score ?? null}),
        last_signal_at = now(),
        sales_customer_id = COALESCE(marketing_leads.sales_customer_id, ${existingAnonymousLead.sales_customer_id ?? null}),
        updated_at = now()
      WHERE id = ${result.lead.id}
        AND owner_user_id = ${ownerUserId}
      RETURNING *
    `;

    if (!mergedLead) {
      throw new Error("Failed to merge anonymous lead into email lead");
    }

    persistedLead = mergedLead;

    let cleanedUpAnonLead = false;
    let usedDeletedAt = false;
    let usedMergedToId = false;
    try {
      await db.exec`
        UPDATE marketing_leads
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${existingAnonymousLead.id}
          AND owner_user_id = ${ownerUserId}
      `;
      cleanedUpAnonLead = true;
      usedDeletedAt = true;
    } catch (error) {
      const pgError = error as PgError;
      if (pgError.code !== "42703") {
        throw error;
      }

      try {
        await db.exec`
          UPDATE marketing_leads
          SET merged_to_id = ${result.lead.id}, updated_at = now()
          WHERE id = ${existingAnonymousLead.id}
            AND owner_user_id = ${ownerUserId}
        `;
        cleanedUpAnonLead = true;
        usedMergedToId = true;
      } catch (mergeMarkerError) {
        const mergeMarkerPgError = mergeMarkerError as PgError;
        if (mergeMarkerPgError.code !== "42703") {
          throw mergeMarkerError;
        }
      }
    }

    console.info("[identify] merged anonymous lead", {
      merge_performed: true,
      anon_cleanup_performed: cleanedUpAnonLead,
      anon_cleanup_used_deleted_at: usedDeletedAt,
      anon_cleanup_used_merged_to_id: usedMergedToId,
    });
  }

  console.info("[identify] lead persistence", {
    email_provided: emailProvided,
    contact_name_provided: contactNameProvided,
    company_name_provided: companyNameProvided,
    has_email: !!persistedLead.email,
    has_contact_name: !!persistedLead.contact_name,
    has_company: !!persistedLead.company,
    has_company_name: !!persistedLead.company_name,
  });

  return {
    lead: persistedLead,
    lead_created: result.lead_created,
  };
}

async function handleIdentify(req: IdentifyRequest, corr?: string): Promise<IdentifyResponse> {
  try {
    console.info("[identify] Request", {
      has_email: hasNonEmptyString(req.email),
      anonymous_id: req.anonymous_id,
      has_contact_name: hasNonEmptyString(req.contact_name),
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

    const normalizedEmail = typeof req.email === "string" ? req.email.trim().toLowerCase() : "";
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
        hasEmail: hasNonEmptyString(payload?.email),
        hasAnonymousId: hasNonEmptyString(payload?.anonymous_id),
        hasContactName: hasNonEmptyString(payload?.contact_name),
        hasCompanyName: hasNonEmptyString(payload?.company_name),
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
