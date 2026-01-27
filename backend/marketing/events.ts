import { api, APIError } from "encore.dev/api";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/db";

interface EventsQuery {
  limit?: number | string;
  offset?: number | string;
  lead_id?: string;
  event_type?: string;
  event_source?: string;
  dedupe_key?: string;
  anonymous_id?: string;
  since?: string;
}

interface EventItem {
  id: string;
  event_type: string;
  event_source: string;
  anonymous_id: string | null;
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

function clampOffset(rawOffset: number | string | undefined): number {
  const parsed =
    typeof rawOffset === "number" ? rawOffset : parseInt(rawOffset ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(parsed, 0);
}

// Debug-only verification endpoint for ingest -> DB -> read path.
export const listEvents = api<EventsQuery, EventsResponse>(
  { expose: true, method: "GET", path: "/api/v1/events" },
  async (params) => {
    const request_id = uuidv4();
    const limit = clampLimit(params.limit);
    const offset = clampOffset(params.offset);
    const since = parseSince(params.since);

    let query = `
      SELECT
        id,
        event_type,
        event_source,
        anonymous_id,
        dedupe_key,
        metadata,
        occurred_at
      FROM intent_events
      WHERE 1=1
    `;

    const queryParams: Array<string | number> = [];

    if (params.lead_id) {
      queryParams.push(params.lead_id);
      query += ` AND lead_id = $${queryParams.length}`;
    }

    if (params.event_type) {
      queryParams.push(params.event_type);
      query += ` AND event_type = $${queryParams.length}`;
    }

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
        anonymous_id = $${anonIndex}
        OR metadata->>'anonymous_id' = $${anonIndex}
      )`;
    }

    if (since) {
      queryParams.push(since);
      query += ` AND occurred_at >= $${queryParams.length}`;
    }

    query += ` ORDER BY occurred_at DESC, id DESC`;
    
    if (offset > 0) {
      queryParams.push(offset);
      query += ` OFFSET $${queryParams.length}`;
    }
    
    queryParams.push(limit);
    query += ` LIMIT $${queryParams.length}`;

    try {
      const rows = await db.rawQueryAll<EventItem>(query, ...queryParams);

      return {
        items: rows,
        count: rows.length,
      };
    } catch (err: any) {
      const errCode = err?.code || "unknown";
      const errMessage = err?.message || String(err);
      console.error(`[events] Error in /api/v1/events handler`, {
        request_id,
        err_code: errCode,
        err_message: errMessage,
      });
      throw err;
    }
  }
);
