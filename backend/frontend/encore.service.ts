import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export default new Service("frontend");

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function getDistDir(): string {
  const candidates: string[] = [];

  try {
    candidates.push(fileURLToPath(new URL("./dist/", import.meta.url)));
  } catch {
    // ignore
  }

  // Common working directories:
  // - Render start command runs from repo root or `backend/`
  candidates.push(resolve(process.cwd(), "frontend", "dist"));
  candidates.push(resolve(process.cwd(), "backend", "frontend", "dist"));

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "index.html"))) {
      return candidate;
    }
  }

  // Fallback to first candidate if nothing exists (will 404 quickly)
  return candidates[0] ?? resolve(process.cwd(), "frontend", "dist");
}

const distDir = getDistDir();

function resolveAssetPath(pathname: string): string {
  const sanitized = pathname.startsWith("/app")
    ? pathname.slice("/app".length)
    : pathname;
  const relative = sanitized === "" ? "/" : sanitized;
  const resolved = resolve(distDir, `.${relative}`);
  if (!resolved.startsWith(distDir)) {
    return resolve(distDir, "index.html");
  }
  return resolved;
}

async function serveSpa(req: Request): Promise<Response> {
  // Encore raw requests may provide relative URLs (e.g. "/app").
  const { pathname } = new URL(req.url, "http://localhost");

  const shouldServeIndex =
    pathname === "/app" || pathname === "/app/" || !pathname.includes(".");

  const targetPath = shouldServeIndex
    ? resolve(distDir, "index.html")
    : resolveAssetPath(pathname);

  try {
    const body = await readFile(targetPath);
    const contentType =
      contentTypes[extname(targetPath).toLowerCase()] ??
      "application/octet-stream";

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

// Keep endpoint names aligned with `encore.gen` (service entrypoint imports).
export const appRoot = api.raw(
  { expose: true, method: "GET", path: "/app" },
  serveSpa
);

export const assets = api.raw(
  { expose: true, method: "GET", path: "/app/*path" },
  serveSpa
);