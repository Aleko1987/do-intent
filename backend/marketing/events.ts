import { api, APIError } from "encore.dev/api";
import { db } from "../db/db";

interface EventsQuery {
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
  occurred_at: string;
  metadata: Record<string, unknown>;
}

interface EventsResponse {
  items: EventItem[];
  count: number;
}

function clampLimit(rawLimit: number | string | undefined): number {
  const parsed =
    typeof rawLimit === "number" ? rawLimit : parseInt(rawLimit ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 20;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

function parseSince(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw APIError.invalidArgument("since must be a valid ISO timestamp");
  }
  return parsed.toISOString();
}

// Debug-only verification endpoint for ingest -> DB -> read path.
export const listEvents = api<EventsQuery, EventsResponse>(
  { expose: true, method: "GET", path: "/api/v1/events" },
  async (params) => {
    const limit = clampLimit(params.limit);
    const since = parseSince(params.since);

    let query = `
      SELECT
        id,
        event_type,
        event_source,
        dedupe_key,
        metadata,
        occurred_at
      FROM intent_events
      WHERE 1=1
    `;

    const queryParams: Array<string | number> = [];

    if (params.event_source) {
      queryParams.push(params.event_source);
      query += ` AND event_source = $${queryParams.length}`;
    }

    if (params.dedupe_key) {
      queryParams.push(params.dedupe_key);
      query += ` AND dedupe_key = $${queryParams.length}`;
    }

    if (params.anonymous_id) {
      queryParams.push(params.anonymous_id);
      const anonIndex = queryParams.length;
      query += ` AND (
        metadata->>'anonymous_id' = $${anonIndex}
      )`;
    }

    if (since) {
      queryParams.push(since);
      query += ` AND occurred_at >= $${queryParams.length}`;
    }

    query += ` ORDER BY occurred_at DESC, id DESC`;
    queryParams.push(limit);
    query += ` LIMIT $${queryParams.length}`;

    const items = await db.rawQueryAll<EventItem>(query, ...queryParams);

    return {
      items,
      count: items.length,
    };
  }
);
