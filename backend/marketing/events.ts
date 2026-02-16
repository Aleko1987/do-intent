import { api, APIError } from "encore.dev/api";
import { db } from "../db/db";
import type { JsonObject } from "../internal/json_types";

interface ListEventsRequest {
  limit?: number;
  event_source?: string;
  dedupe_key?: string;
  anonymous_id?: string;
  since?: string;
}

interface IntentEventRow {
  id: string;
  event_type: string;
  event_source: string;
  dedupe_key: string | null;
  occurred_at: string;
  metadata: JsonObject;
  anonymous_id: string | null;
}

interface ListEventsResponse {
  count: number;
  items: IntentEventRow[];
}

function parseLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 20;
  }

  if (!Number.isFinite(limit) || !Number.isInteger(limit)) {
    throw APIError.invalidArgument("limit must be an integer");
  }

  if (limit <= 0) {
    throw APIError.invalidArgument("limit must be greater than 0");
  }

  return Math.min(limit, 100);
}

function parseSince(since: string | undefined): string | undefined {
  if (!since) {
    return undefined;
  }

  const parsed = new Date(since);
  if (Number.isNaN(parsed.getTime())) {
    throw APIError.invalidArgument("since must be a valid ISO timestamp");
  }

  return parsed.toISOString();
}

// Debug/verification read endpoint: confirms ingest -> DB -> read path.
export const listEvents = api<ListEventsRequest, ListEventsResponse>(
  { expose: true, method: "GET", path: "/api/v1/events" },
  async (params) => {
    const queryParams: unknown[] = [];
    const whereClauses: string[] = [];

    if (params.event_source) {
      queryParams.push(params.event_source);
      whereClauses.push(`event_source = $${queryParams.length}`);
    }

    if (params.dedupe_key) {
      queryParams.push(params.dedupe_key);
      whereClauses.push(`dedupe_key = $${queryParams.length}`);
    }

    if (params.anonymous_id) {
      queryParams.push(params.anonymous_id);
      const idx = queryParams.length;
      whereClauses.push(`(anonymous_id = $${idx} OR metadata->>'anonymous_id' = $${idx})`);
    }

    const since = parseSince(params.since);
    if (since) {
      queryParams.push(since);
      whereClauses.push(`occurred_at >= $${queryParams.length}`);
    }

    const limit = parseLimit(params.limit);
    queryParams.push(limit);

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT
        id,
        event_type,
        event_source,
        dedupe_key,
        occurred_at,
        metadata,
        anonymous_id
      FROM intent_events
      ${whereSql}
      ORDER BY occurred_at DESC
      LIMIT $${queryParams.length}
    `;

    const items = await db.rawQueryAll<IntentEventRow>(query, ...queryParams);

    return {
      count: items.length,
      items,
    };
  }
);
