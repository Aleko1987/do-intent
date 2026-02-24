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
  applyCorsHeadersWithOptions(req, res, {});
}

interface CorsHeaderOptions {
  allowedOrigins?: readonly string[];
  allowAnyOriginFallback?: boolean;
  allowCredentials?: boolean;
  allowMethods?: string;
  allowHeaders?: string;
}

export function applyCorsHeadersWithOptions(
  req: IncomingMessage,
  res: ServerResponse,
  options: CorsHeaderOptions
): void {
  // GUARD: Prevent duplicates if Encore or another middleware already set the header.
  if (res.getHeader("Access-Control-Allow-Origin")) {
    return;
  }

  const allowlist = new Set(options.allowedOrigins ?? parseAllowedOrigins());
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const normalizedOrigin = requestOrigin ? normalizeOrigin(requestOrigin) : null;
  const allowAnyOriginFallback = options.allowAnyOriginFallback ?? true;
  const allowCredentials = options.allowCredentials ?? true;
  const allowMethods = options.allowMethods ?? "GET,POST,OPTIONS";
  const allowHeaders =
    options.allowHeaders ??
    "Content-Type, Authorization, x-ingest-api-key, x-do-intent-key, x-marketing-admin-key, x-request-id";

  if (normalizedOrigin && allowlist.has(normalizedOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
    if (allowCredentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Vary", "Origin");
  } else if (allowAnyOriginFallback) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", allowMethods);
  res.setHeader("Access-Control-Allow-Headers", allowHeaders);
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
