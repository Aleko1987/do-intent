import { api, RawRequest, RawResponse } from "encore.dev/api";
import { timingSafeEqual } from "crypto";
import { db } from "../db/db";
import { resolveDebugKey } from "../internal/env_secrets";

function getHeader(req: RawRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    const max = Math.max(aBuf.length, bBuf.length);
    const paddedA = Buffer.concat([aBuf, Buffer.alloc(max - aBuf.length)]);
    const paddedB = Buffer.concat([bBuf, Buffer.alloc(max - bBuf.length)]);
    timingSafeEqual(paddedA, paddedB);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function sendJson(resp: RawResponse, statusCode: number, body: unknown): void {
  resp.statusCode = statusCode;
  resp.setHeader("content-type", "application/json; charset=utf-8");
  resp.end(JSON.stringify(body));
}

function isDbEnabled(): boolean {
  return (process.env.ENABLE_DB || "").toLowerCase() === "true";
}

function hasDatabaseConfig(): boolean {
  if (process.env.DATABASE_URL) {
    return true;
  }
  return Boolean(
    process.env.DATABASE_USER &&
      process.env.DATABASE_PASSWORD &&
      process.env.DATABASE_HOSTPORT &&
      process.env.DATABASE_NAME
  );
}

function requireDebugKey(req: RawRequest, resp: RawResponse): boolean {
  const expectedKey = resolveDebugKey();
  if (!expectedKey) {
    sendJson(resp, 500, {
      code: "missing_secret",
      message: "Debug key is not configured",
    });
    return false;
  }

  const headerKey = (getHeader(req, "x-debug-key") ?? "").trim();
  if (!headerKey) {
    sendJson(resp, 401, {
      code: "unauthorized",
      message: "missing x-debug-key header",
    });
    return false;
  }

  if (!constantTimeEquals(headerKey, expectedKey)) {
    sendJson(resp, 401, {
      code: "unauthorized",
      message: "invalid debug key",
    });
    return false;
  }

  return true;
}

async function handleDebugEnv(req: RawRequest, resp: RawResponse): Promise<void> {
  if (!requireDebugKey(req, resp)) {
    return;
  }

  sendJson(resp, 200, {
    ok: true,
    env: {
      node_env: process.env.NODE_ENV ?? "unknown",
      port_set: Boolean(process.env.PORT),
      enable_db: isDbEnabled(),
      has_database_url: hasDatabaseConfig(),
      allowed_ingest_origins_set: Boolean(process.env.ALLOWED_INGEST_ORIGINS),
    },
  });
}

async function handleDebugDb(req: RawRequest, resp: RawResponse): Promise<void> {
  if (!requireDebugKey(req, resp)) {
    return;
  }

  if (!hasDatabaseConfig()) {
    sendJson(resp, 200, {
      ok: false,
      configured: false,
      message: "database not configured",
    });
    return;
  }

  try {
    await db.rawQueryRow("SELECT 1");
    sendJson(resp, 200, { ok: true, configured: true });
  } catch (error) {
    sendJson(resp, 200, {
      ok: false,
      configured: true,
      message: "database query failed",
    });
  }
}

export const debugEnv = api.raw(
  { expose: true, method: "GET", path: "/api/v1/debug/env" },
  (req, resp) => {
    void handleDebugEnv(req, resp);
  }
);

export const debugDb = api.raw(
  { expose: true, method: "GET", path: "/api/v1/debug/db" },
  (req, resp) => {
    void handleDebugDb(req, resp);
  }
);
