import { api, Header, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import db from "../db";
import type { IntentEvent } from "./types";
import { autoScoreEvent } from "../intent_scorer/auto_score";

export const IngestApiKey = secret("IngestApiKey");

// Parse allowed origins from environment
function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_INGEST_ORIGINS;
  if (!origins) {
    return [];
  }
  return origins.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

// Whitelist of allowed event types
const ALLOWED_EVENT_TYPES = [
  "page_view",
  "pricing_view",
  "contact_view",
  "case_study_view",
  "form_start",
  "form_submit",
  "link_click",
  "identify",
];

interface IngestIntentEventRequest {
  "x-do-intent-key"?: Header<"x-do-intent-key">;
  "origin"?: Header<"origin">;
  "referer"?: Header<"referer">;
  event_source?: string;
  event_type: string;
  occurred_at?: string;
  lead_id?: string; // Optional; required if anonymous_id is not provided
  anonymous_id?: string; // Optional; required if lead_id is not provided
  url?: string;
  path?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  metadata?: Record<string, any>;
}

interface IngestIntentEventResponse {
  event_id: string;
  lead_id: string | null;
  scored: boolean;
}

// Validates and normalizes the request
function validateAndNormalize(req: IngestIntentEventRequest): {
  event_type: string;
  event_source: string;
  occurred_at: string;
  lead_id: string | null;
  metadata: Record<string, any>;
} {
  // Validate that either lead_id or anonymous_id is provided
  if (!req.lead_id && !req.anonymous_id) {
    throw APIError.invalidArgument("either lead_id or anonymous_id is required");
  }
  
  // Validate lead_id format if provided
  if (req.lead_id && typeof req.lead_id !== "string") {
    throw APIError.invalidArgument("lead_id must be a UUID string");
  }
  
  // Validate anonymous_id format if provided
  if (req.anonymous_id && typeof req.anonymous_id !== "string") {
    throw APIError.invalidArgument("anonymous_id must be a string");
  }

  // Validate event_type
  if (!req.event_type || typeof req.event_type !== "string") {
    throw new Error("event_type is required and must be a string");
  }
  if (!ALLOWED_EVENT_TYPES.includes(req.event_type)) {
    throw new Error(`event_type must be one of: ${ALLOWED_EVENT_TYPES.join(", ")}`);
  }

  // Normalize event_source (default to "website")
  const event_source = req.event_source || "website";

  // Normalize occurred_at (default to now)
  const occurred_at = req.occurred_at || new Date().toISOString();

  // Build metadata object
  const metadata: Record<string, any> = {
    ...(req.metadata || {}),
  };

  // Add optional fields to metadata if provided
  if (req.anonymous_id) {
    metadata.anonymous_id = req.anonymous_id;
  }
  if (req.url) {
    metadata.url = req.url;
  }
  if (req.path) {
    metadata.path = req.path;
  }
  if (req.referrer) {
    metadata.referrer = req.referrer;
  }
  if (req.utm_source) {
    metadata.utm_source = req.utm_source;
  }
  if (req.utm_medium) {
    metadata.utm_medium = req.utm_medium;
  }
  if (req.utm_campaign) {
    metadata.utm_campaign = req.utm_campaign;
  }
  if (req.utm_content) {
    metadata.utm_content = req.utm_content;
  }

  // Normalize empty strings to null in metadata
  for (const key in metadata) {
    if (metadata[key] === "") {
      metadata[key] = null;
    }
  }

  // Clamp metadata size (16kb limit)
  const metadataStr = JSON.stringify(metadata);
  if (metadataStr.length > 16 * 1024) {
    throw new Error("metadata exceeds 16kb limit");
  }

  return {
    event_type,
    event_source,
    occurred_at,
    lead_id: req.lead_id || null,
    metadata,
  };
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

// POST endpoint for ingesting intent events from website
export const ingestIntentEvent = api<IngestIntentEventRequest, IngestIntentEventResponse>(
  { expose: true, method: "POST", path: "/marketing/ingest-intent-event" },
  async (req) => {
    // Check API key
    checkApiKey(req["x-do-intent-key"]);

    // Check origin allowlist
    checkOrigin(req.origin, req.referer);

    const normalized = validateAndNormalize(req);

    // Verify lead exists if lead_id is provided
    if (normalized.lead_id) {
      const lead = await db.queryRow<{ id: string }>`
        SELECT id FROM marketing_leads WHERE id = ${normalized.lead_id}
      `;

      if (!lead) {
        throw APIError.notFound("lead not found");
      }
    }

    // Get scoring rule for event_value (optional, for backward compatibility)
    const rule = await db.queryRow<{ points: number }>`
      SELECT points FROM scoring_rules
      WHERE event_type = ${normalized.event_type} AND is_active = true
      LIMIT 1
    `;

    const eventValue = rule?.points || 0;

    // Insert event
    const event = await db.queryRow<IntentEvent>`
      INSERT INTO intent_events (
        lead_id,
        event_type,
        event_source,
        event_value,
        metadata,
        occurred_at,
        created_at
      ) VALUES (
        ${normalized.lead_id},
        ${normalized.event_type},
        ${normalized.event_source},
        ${eventValue},
        ${JSON.stringify(normalized.metadata)},
        ${normalized.occurred_at},
        now()
      )
      RETURNING *
    `;

    if (!event) {
      throw new Error("Failed to create event");
    }

    // Auto-score the event
    await autoScoreEvent(event.id);

    return {
      event_id: event.id,
      lead_id: event.lead_id,
      scored: true,
    };
  }
);

