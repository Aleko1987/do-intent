import type { IncomingMessage, ServerResponse } from "node:http";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://earthcurebiodiesel.com",
  "https://www.earthcurebiodiesel.com",
];

function parseAllowedOrigins(): Set<string> {
  const configured = process.env.CORS_ALLOWED_ORIGINS;
  const values = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  return new Set(values);
}

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

export function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const allowlist = parseAllowedOrigins();
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const normalizedOrigin = requestOrigin ? normalizeOrigin(requestOrigin) : null;

  if (normalizedOrigin && allowlist.has(normalizedOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-ingest-api-key, x-do-intent-key, x-request-id"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function handleCorsPreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if ((req.method ?? "").toUpperCase() !== "OPTIONS") {
    return false;
  }
  applyCorsHeaders(req, res);
  res.statusCode = 204;
  res.end();
  return true;
}

export async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", resolve);
    req.on("error", reject);
  });

  if (chunks.length === 0) {
    return {} as T;
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as T;
}
