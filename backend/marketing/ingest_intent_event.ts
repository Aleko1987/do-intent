import { api } from "encore.dev/api";
import db from "../db";
import type { IntentEvent } from "./types";
import { autoScoreEvent } from "../intent_scorer/auto_score";

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
  event_source?: string;
  event_type: string;
  occurred_at?: string;
  lead_id?: string;
  anonymous_id?: string;
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
  lead_id: string;
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

  // Determine lead_id
  let lead_id: string | null = null;
  if (req.lead_id) {
    lead_id = req.lead_id;
  } else if (req.anonymous_id) {
    // For anonymous events, we'll need to create a temporary lead
    // This will be handled in the main function
    lead_id = null; // Will be set after creating temp lead
  } else {
    throw new Error("Either lead_id or anonymous_id must be provided");
  }

  return {
    event_type,
    event_source,
    occurred_at,
    lead_id,
    metadata,
  };
}

// Checks API key from header
function checkApiKey(): void {
  // In Encore, we can access headers via the request context
  // For now, we'll use a simple approach with environment variable
  // Note: Encore doesn't expose raw headers easily, so we'll use a query param or body field
  // Actually, let's use a header check via Encore's request context if available
  // For v1, we'll skip this and add it as a TODO if needed
  // The user said "minimal security" - we can add this later
}

// POST endpoint for ingesting intent events from website
export const ingestIntentEvent = api<IngestIntentEventRequest, IngestIntentEventResponse>(
  { expose: true, method: "POST", path: "/marketing/ingest-intent-event" },
  async (req) => {
    // TODO: Add API key check via header when Encore supports it
    // For now, this endpoint is public (v1 minimal security)

    const normalized = validateAndNormalize(req);

    let lead_id = normalized.lead_id;

    // If anonymous_id provided but no lead_id, create a temporary lead
    if (!lead_id && req.anonymous_id) {
      // Find existing events with this anonymous_id to get their lead_id
      const existingEvent = await db.queryRow<{ lead_id: string }>`
        SELECT lead_id FROM intent_events
        WHERE metadata->>'anonymous_id' = ${req.anonymous_id}
        LIMIT 1
      `;

      if (existingEvent) {
        lead_id = existingEvent.lead_id;
      } else {
        // Create temporary lead for this anonymous_id
        const tempLead = await db.queryRow<{ id: string }>`
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
            NULL,
            NULL,
            NULL,
            'website',
            'system',
            'M1',
            0,
            now(),
            now()
          )
          RETURNING id
        `;

        if (!tempLead) {
          throw new Error("Failed to create temporary lead");
        }

        lead_id = tempLead.id;
      }
    }

    if (!lead_id) {
      throw new Error("Failed to resolve lead_id");
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
        ${lead_id},
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

