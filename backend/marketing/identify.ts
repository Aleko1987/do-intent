import { api, APIError } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db } from "../db/db";
import { resolveIngestApiKey } from "../internal/env_secrets";
import { handleCorsPreflight, parseJsonBody, setCorsHeaders } from "../lib/cors";
import type { MarketingLead } from "./types";

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

async function handleIdentify(req: IdentifyRequest): Promise<IdentifyResponse> {
  const providedApiKey = req["x-do-intent-key"]?.trim();
  if (providedApiKey && hasValidApiKey(providedApiKey)) {
    // API-key traffic accepted.
  } else if (providedApiKey) {
    throw APIError.permissionDenied("invalid API key");
  } else {
    if (!req.origin && !req.referer) {
      throw APIError.permissionDenied("API key or origin/referer header required");
    }
    checkOrigin(req.origin, req.referer);
  }

  if (!req.anonymous_id || typeof req.anonymous_id !== "string") {
    throw APIError.invalidArgument("anonymous_id is required and must be a string");
  }
  if (!req.email || typeof req.email !== "string") {
    throw APIError.invalidArgument("email is required and must be a string");
  }

  const email = req.email.toLowerCase().trim();
  if (!email) {
    throw APIError.invalidArgument("email cannot be empty");
  }

  let lead = await db.queryRow<MarketingLead>`
    SELECT * FROM marketing_leads
    WHERE lower(email) = ${email}
    LIMIT 1
  `;

  let lead_created = false;

  if (!lead) {
    lead = await db.queryRow<MarketingLead>`
      INSERT INTO marketing_leads (
        company_name,
        contact_name,
        email,
        source_type,
        owner_user_id,
        marketing_stage,
        intent_score,
        created_at,
        updated_at
      ) VALUES (
        ${req.company_name || null},
        ${req.contact_name || null},
        ${email},
        'website',
        'system',
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

    lead_created = true;
  } else {
    if (req.company_name && !lead.company_name) {
      await db.exec`
        UPDATE marketing_leads
        SET company_name = ${req.company_name}, updated_at = now()
        WHERE id = ${lead.id}
      `;
    }
    if (req.contact_name && !lead.contact_name) {
      await db.exec`
        UPDATE marketing_leads
        SET contact_name = ${req.contact_name}, updated_at = now()
        WHERE id = ${lead.id}
      `;
    }
  }

  return {
    lead_id: lead.id,
    lead_created,
  };
}

function getHeaderValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

async function serveIdentify(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (handleCorsPreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

  try {
    const payload = await parseJsonBody<IdentifyPayload>(req);
    const request: IdentifyRequest = {
      ...payload,
      "x-do-intent-key": getHeaderValue(req, "x-do-intent-key"),
      origin: getHeaderValue(req, "origin"),
      referer: getHeaderValue(req, "referer"),
    };

    const response = await handleIdentify(request);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(response));
  } catch (error) {
    if (error instanceof APIError) {
      const status = error.code === "invalid_argument" ? 400 :
        error.code === "permission_denied" || error.code === "unauthenticated" ? 401 : 500;
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ code: error.code, message: error.message }));
      return;
    }

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ code: "internal", message: "Internal Server Error" }));
  }
}

export const identify = api.raw(
  { expose: true, method: "POST", path: "/marketing/identify" },
  serveIdentify
);

export const identifyOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/marketing/identify" },
  serveIdentify
);
