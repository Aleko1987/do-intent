import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
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

async function readFileWithTimeout(path: string, timeoutMs: number): Promise<Uint8Array> {
  return await Promise.race([
    readFile(path),
    new Promise<Uint8Array>((_, reject) =>
      setTimeout(() => reject(new Error("read_timeout")), timeoutMs)
    ),
  ]);
}

async function serveSpa(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? "/";
  const { pathname } = new URL(url, "http://localhost");

  const isHead = (req.method ?? "GET").toUpperCase() === "HEAD";
  const shouldServeIndex =
    pathname === "/app" || pathname === "/app/" || !pathname.includes(".");

  const targetPath = shouldServeIndex
    ? resolve(distDir, "index.html")
    : resolveAssetPath(pathname);

  try {
    const body = await readFileWithTimeout(targetPath, 2000);
    const contentType =
      contentTypes[extname(targetPath).toLowerCase()] ??
      "application/octet-stream";

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", contentType.startsWith("text/html") ? "no-cache" : "public, max-age=31536000, immutable");

    if (isHead) {
      res.end();
      return;
    }

    res.end(body);
  } catch (error) {
    console.error("[frontend] Failed to serve SPA asset.", {
      pathname,
      distDir,
      targetPath,
      error: error instanceof Error ? error.message : String(error),
    });

    res.statusCode = error instanceof Error && error.message === "read_timeout" ? 504 : 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(res.statusCode === 504 ? "Gateway Timeout" : "Not found");
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

export const appRootHead = api.raw(
  { expose: true, method: "HEAD", path: "/app" },
  serveSpa
);

export const assetsHead = api.raw(
  { expose: true, method: "HEAD", path: "/app/*path" },
  serveSpa
);