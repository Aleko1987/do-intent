import { Service } from "encore.dev/service";
import { api, RawRequest, RawResponse } from "encore.dev/api";
import { readFile } from "fs/promises";
import { join, dirname, normalize, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

export default new Service("frontend");

// Resolve dist directory relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, "dist");

// Content-Type mapping for common file extensions
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

async function serveIndexHtml(resp: RawResponse): Promise<void> {
  const indexPath = join(distDir, "index.html");
  try {
    const html = await readFile(indexPath, "utf-8");
    resp.statusCode = 200;
    resp.setHeader("Content-Type", "text/html; charset=utf-8");
    resp.end(html);
  } catch {
    resp.statusCode = 500;
    resp.setHeader("Content-Type", "text/plain; charset=utf-8");
    resp.end("dist missing, run npm run build in backend");
  }
}

// Route A: GET /app endpoint that serves index.html for SPA root
export const appRoot = api.raw(
  { expose: true, method: "GET", path: "/app" },
  async (_req: RawRequest, resp: RawResponse) => {
    await serveIndexHtml(resp);
  }
);

// Route B: Wildcard route for /app/*path - serves static files with SPA fallback
export const assets = api.raw(
  { expose: true, method: "GET", path: "/app/*path" },
  async (req: RawRequest, resp: RawResponse) => {
    // Extract the path parameter from URL (everything after /app/)
    const url = req.url || "/";
    const pathMatch = url.match(/^\/app\/(.*)$/);
    const requestedPath = pathMatch ? pathMatch[1].split("?")[0] : "";

    // Normalize and resolve the path to prevent traversal attacks
    const normalizedPath = normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
    const resolvedPath = resolve(distDir, normalizedPath);

    // Security check: ensure resolved path is within dist directory
    if (!resolvedPath.startsWith(distDir)) {
      resp.statusCode = 403;
      resp.setHeader("Content-Type", "text/plain; charset=utf-8");
      resp.end("Forbidden");
      return;
    }

    // Try to serve the requested file
    if (existsSync(resolvedPath)) {
      try {
        const content = await readFile(resolvedPath);
        resp.statusCode = 200;
        resp.setHeader("Content-Type", getMimeType(resolvedPath));
        resp.end(content);
        return;
      } catch {
        // Fall through to SPA fallback
      }
    }

    // SPA fallback: serve index.html for non-existent paths
    await serveIndexHtml(resp);
  }
);