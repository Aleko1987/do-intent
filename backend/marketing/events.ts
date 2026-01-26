import { api } from "encore.dev/api";
import { db } from "../db/db";
import type { IntentEvent } from "./types";

interface EventsQuery {
  limit?: number | string;
  event_source?: string;
  dedupe_key?: string;
  anonymous_id?: string;
  since?: string;
}

interface EventsResponse {
  items: IntentEvent[];
  count: number;
  limit: number;
  cursor?: string | null;
  timing_ms?: number;
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
    throw new Error("Invalid since timestamp");
  }
  return parsed.toISOString();
}

export const listEvents = api<EventsQuery, EventsResponse>(
  { expose: true, method: "GET", path: "/api/v1/events" },
  async (params) => {
    const start = Date.now();
    const limit = clampLimit(params.limit);
    const since = parseSince(params.since);

    let query = `
      SELECT
        id,
        lead_id,
        event_type,
        event_source,
        event_value,
        dedupe_key,
        metadata,
        occurred_at,
        created_at
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
        OR metadata->>'anonymousId' = $${anonIndex}
        OR metadata->>'anon_id' = $${anonIndex}
      )`;
    }

    if (since) {
      queryParams.push(since);
      query += ` AND occurred_at >= $${queryParams.length}`;
    }

    query += ` ORDER BY created_at DESC, id DESC`;
    queryParams.push(limit);
    query += ` LIMIT $${queryParams.length}`;

    const items = await db.rawQueryAll<IntentEvent>(query, ...queryParams);

    return {
      items,
      count: items.length,
      limit,
      cursor: null,
      timing_ms: Date.now() - start,
    };
  }
);
