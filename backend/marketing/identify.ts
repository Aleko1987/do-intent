import { api, Header, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import db from "../db";
import type { MarketingLead } from "./types";

export const IngestApiKey = secret("IngestApiKey");

// Parse allowed origins from environment
function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_INGEST_ORIGINS;
  if (!origins) {
    return [];
  }
  return origins.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

interface IdentifyRequest {
  "x-do-intent-key"?: Header<"x-do-intent-key">;
  "origin"?: Header<"origin">;
  "referer"?: Header<"referer">;
  anonymous_id: string;
  email: string;
  company_name?: string;
  contact_name?: string;
}

interface IdentifyResponse {
  lead_id: string;
  lead_created: boolean;
}

// Checks API key from header
function checkApiKey(headerKey: string | undefined): void {
  const expectedKey = IngestApiKey();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!expectedKey) {
      throw APIError.internal("IngestApiKey secret is required in production");
    }
    if (!headerKey || headerKey !== expectedKey) {
      throw APIError.unauthenticated("missing or invalid x-do-intent-key header");
    }
  } else {
    // In dev, enforce if secret is set, but allow if not set
    if (expectedKey && (!headerKey || headerKey !== expectedKey)) {
      throw APIError.unauthenticated("missing or invalid x-do-intent-key header");
    }
  }
}

// Checks origin allowlist
function checkOrigin(origin: string | undefined, referer: string | undefined): void {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) {
    // If no allowlist configured, allow localhost in dev, otherwise allow all
    if (process.env.NODE_ENV !== "production") {
      return; // Allow all in dev if no allowlist
    }
    return; // In production without allowlist, allow all (admin's choice)
  }

  // Extract hostname from Origin or Referer
  let hostname: string | null = null;
  if (origin) {
    try {
      const url = new URL(origin);
      hostname = url.hostname;
    } catch {
      // Invalid origin format, ignore
    }
  }
  if (!hostname && referer) {
    try {
      const url = new URL(referer);
      hostname = url.hostname;
    } catch {
      // Invalid referer format, ignore
    }
  }

  if (!hostname) {
    // No valid origin/referer, reject if allowlist is set
    throw APIError.permissionDenied("origin or referer header required");
  }

  // Check if hostname matches any allowed origin
  const isAllowed = allowedOrigins.some((allowed) => {
    // Exact match or subdomain match
    return hostname === allowed || hostname!.endsWith(`.${allowed}`);
  });

  if (!isAllowed) {
    throw APIError.permissionDenied(`origin ${hostname} not in allowlist`);
  }
}

// POST endpoint for identifying users (find-or-create lead by email)
export const identify = api<IdentifyRequest, IdentifyResponse>(
  { expose: true, method: "POST", path: "/marketing/identify" },
  async (req) => {
    // Check API key
    checkApiKey(req["x-do-intent-key"]);

    // Check origin allowlist
    checkOrigin(req.origin, req.referer);

    // Validate inputs
    if (!req.anonymous_id || typeof req.anonymous_id !== "string") {
      throw APIError.invalidArgument("anonymous_id is required and must be a string");
    }
    if (!req.email || typeof req.email !== "string") {
      throw APIError.invalidArgument("email is required and must be a string");
    }

    // Normalize email (lowercase, trim)
    const email = req.email.toLowerCase().trim();
    if (!email) {
      throw APIError.invalidArgument("email cannot be empty");
    }

    // Find or create lead by email (following webhook_event.ts pattern)
    let lead = await db.queryRow<MarketingLead>`
      SELECT * FROM marketing_leads
      WHERE lower(email) = ${email}
      LIMIT 1
    `;

    let lead_created = false;

    if (!lead) {
      // Create new lead (following webhook_event.ts pattern)
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
      // Update existing lead with provided info (if not already set)
      if (req.company_name && !lead.company_name) {
        await db.exec`
          UPDATE marketing_leads
          SET company_name = ${req.company_name}, updated_at = now()
          WHERE id = ${lead.id}
        `;
        lead.company_name = req.company_name;
      }
      if (req.contact_name && !lead.contact_name) {
        await db.exec`
          UPDATE marketing_leads
          SET contact_name = ${req.contact_name}, updated_at = now()
          WHERE id = ${lead.id}
        `;
        lead.contact_name = req.contact_name;
      }
    }

    return {
      lead_id: lead.id,
      lead_created,
    };
  }
);

