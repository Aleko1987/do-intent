import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOWED_ORIGINS = [
  "https://earthcurebiodiesel.com",
  "https://www.earthcurebiodiesel.com",
  "https://earthcureind.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-do-intent-key, x-ingest-api-key, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function handleOptions(req: Request): Response {
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export function corsResponse(data: unknown, status = 200, origin?: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(origin ?? null),
    },
  });
}

export function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : null;
  const corsHeaders = getCorsHeaders(origin);

  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

export function handleCorsPreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if ((req.method ?? "").toUpperCase() !== "OPTIONS") {
    return false;
  }

  setCorsHeaders(req, res);
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
