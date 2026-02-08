import { Header, APIError } from "encore.dev/api";
import { timingSafeEqual } from "crypto";
import { db } from "../db/db";
import { resolveDebugKey } from "../internal/env_secrets";

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

function requireDebugKey(headerKey: string | undefined): boolean {
  const expectedKey = resolveDebugKey();
  if (!expectedKey) {
    return false;
  }

  const trimmed = (headerKey ?? "").trim();
  if (!trimmed) {
    return false;
  }

  if (!constantTimeEquals(trimmed, expectedKey)) {
    return false;
  }

  return true;
}

interface DebugEnvRequest {
  "x-debug-key"?: Header<"x-debug-key">;
  dummy?: string;
}

interface DebugEnvResponse {
  ok: true;
  env: {
    node_env: string;
    port_set: boolean;
    enable_db: boolean;
    has_database_url: boolean;
    allowed_ingest_origins_set: boolean;
  };
}

async function handleDebugEnv(req: DebugEnvRequest): Promise<DebugEnvResponse> {
  if (!requireDebugKey(req["x-debug-key"])) {
    throw APIError.unauthenticated("invalid or missing x-debug-key");
  }

  return {
    ok: true,
    env: {
      node_env: process.env.NODE_ENV ?? "unknown",
      port_set: Boolean(process.env.PORT),
      enable_db: isDbEnabled(),
      has_database_url: hasDatabaseConfig(),
      allowed_ingest_origins_set: Boolean(process.env.ALLOWED_INGEST_ORIGINS),
    },
  };
}

interface DebugDbRequest {
  "x-debug-key"?: Header<"x-debug-key">;
  dummy?: string;
}

interface DebugDbResponse {
  ok: boolean;
  configured: boolean;
  message?: string;
}

async function handleDebugDb(req: DebugDbRequest): Promise<DebugDbResponse> {
  if (!requireDebugKey(req["x-debug-key"])) {
    throw APIError.unauthenticated("invalid or missing x-debug-key");
  }

  if (!hasDatabaseConfig()) {
    return {
      ok: false,
      configured: false,
      message: "database not configured",
    };
  }

  try {
    await db.rawQueryRow("SELECT 1");
    return { ok: true, configured: true };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: "database query failed",
    };
  }
}

export function debugEnvDisabled(): never {
  throw new Error("debug endpoint disabled");
}

export function debugDbDisabled(): never {
  throw new Error("debug endpoint disabled");
}
