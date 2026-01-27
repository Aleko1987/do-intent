import { api, APIError } from "encore.dev/api";
import { db } from "../db/db";

interface ListEventsParams {
  limit?: number | string;
  event_source?: string;
  dedupe_key?: string;
  anonymous_id?: string;
  since?: string;
}

interface EventItem {
  id: string;
  event_type: string;
  event_source: string;
  dedupe_key: string | null;
  occurred_at: string | null;
  created_at: string | null;
  metadata: Record<string, unknown>;
}

interface ListEventsResponse {
  count: number;
  items: EventItem[];
}

function clampLimit(rawLimit: number | string | undefined): number {
  const parsed =
    typeof rawLimit === "number" ? rawLimit : parseInt(rawLimit ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 20;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

function parseOptionalString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSince(value: string | undefined): string | null {
  const normalized = parseOptionalString(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    throw APIError.invalidArgument("since must be a valid ISO timestamp");
  }
  return parsed.toISOString();
}

export const listEvents = api<ListEventsParams, ListEventsResponse>(
  { expose: true, method: "GET", path: "/api/v1/events" },
  async (params) => {
    const limit = clampLimit(params.limit);
    const eventSource = parseOptionalString(params.event_source);
    const dedupeKey = parseOptionalString(params.dedupe_key);
    const anonymousId = parseOptionalString(params.anonymous_id);
    const since = parseSince(params.since);

    let query = `
      SELECT
        id,
        event_type,
        event_source,
        dedupe_key,
        occurred_at,
        created_at,
        metadata
      FROM intent_events
      WHERE 1=1
    `;

    const queryParams: Array<string | number> = [];

    if (eventSource) {
      queryParams.push(eventSource);
      query += ` AND event_source = $${queryParams.length}`;
    }

    if (dedupeKey) {
      queryParams.push(dedupeKey);
      query += ` AND dedupe_key = $${queryParams.length}`;
    }

    if (anonymousId) {
      queryParams.push(anonymousId);
      query += ` AND metadata->>'anonymous_id' = $${queryParams.length}`;
    }

    if (since) {
      queryParams.push(since);
      query += ` AND COALESCE(occurred_at, created_at) >= $${queryParams.length}`;
    }

    query += ` ORDER BY COALESCE(occurred_at, created_at) DESC`;
    queryParams.push(limit);
    query += ` LIMIT $${queryParams.length}`;

    const items = await db.rawQueryAll<EventItem>(query, ...queryParams);

    return {
      count: items.length,
      items,
    };
  }
);
