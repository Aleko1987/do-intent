import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Pool } from "pg";

interface TrackRequest {
  event: string;
  session_id: string;
  anonymous_id: string;
  url: string;
  referrer?: string;
  timestamp: string;
  value?: number;
  metadata?: Record<string, any>;
}

interface TrackResponse {
  ok: true;
}

interface ErrorResponse {
  code: "invalid_argument" | "internal";
  message: string;
  details?: unknown;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let bootstrapPromise: Promise<void> | null = null;

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function ensureIntentEventsTable(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS intent_events (
          id bigserial primary key,
          created_at timestamptz not null default now(),
          event text not null,
          session_id uuid not null,
          anonymous_id uuid not null,
          clerk_user_id text null,
          url text not null,
          referrer text null,
          ts timestamptz null,
          value double precision null,
          metadata jsonb null
        );
      `)
      .then(() => undefined);
  }

  await bootstrapPromise;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw APIError.invalidArgument(`${field} is required and must be a string`);
  }
  return value.trim();
}

function parseIsoTimestamp(value: unknown): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw APIError.invalidArgument("timestamp is required and must be an ISO string");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw APIError.invalidArgument("timestamp must be a valid ISO date string");
  }

  return parsed;
}

function invalidUuidError(field: string): never {
  throw APIError.invalidArgument(`${field} is required and must be a valid UUID`);
}

export const track = api<TrackRequest, TrackResponse | ErrorResponse>(
  { expose: true, method: "POST", path: "/track" },
  async (req): Promise<TrackResponse> => {
    if (!process.env.DATABASE_URL) {
      throw APIError.internal("DATABASE_URL is not configured");
    }

    const event = requireNonEmptyString(req.event, "event");

    if (!req.session_id || !isValidUUID(req.session_id)) {
      invalidUuidError("session_id");
    }

    if (!req.anonymous_id || !isValidUUID(req.anonymous_id)) {
      invalidUuidError("anonymous_id");
    }

    const url = requireNonEmptyString(req.url, "url");
    const occurredAt = parseIsoTimestamp(req.timestamp);
    const referrer = typeof req.referrer === "string" ? req.referrer : null;

    let clerkUserId: string | null = null;
    try {
      const authData = getAuthData();
      if (authData?.userID) {
        clerkUserId = authData.userID;
      }
    } catch {
      clerkUserId = null;
    }

    const metadata = req.metadata ?? null;

    try {
      await ensureIntentEventsTable();
      await pool.query(
        `
          INSERT INTO intent_events (
            event,
            session_id,
            anonymous_id,
            clerk_user_id,
            url,
            referrer,
            ts,
            value,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          event,
          req.session_id,
          req.anonymous_id,
          clerkUserId,
          url,
          referrer,
          occurredAt.toISOString(),
          req.value ?? null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
    } catch (error) {
      throw APIError.internal("Failed to record intent event", error as Error);
    }

    return { ok: true };
  }
);
