import { api } from "encore.dev/api";
import { readFile } from "fs/promises";
import { extname, resolve } from "path";
import { fileURLToPath } from "url";

const distDir = fileURLToPath(new URL("./dist/", import.meta.url));

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

function resolveAssetPath(urlPath: string): string {
  const sanitized = urlPath.startsWith("/app")
    ? urlPath.slice("/app".length)
    : urlPath;
  const relative = sanitized === "" ? "/" : sanitized;
  const resolved = resolve(distDir, `.${relative}`);
  if (!resolved.startsWith(distDir)) {
    return resolve(distDir, "index.html");
  }
  return resolved;
}

async function handleFrontendRequest(req: Request): Promise<Response> {
  // Encore raw requests may provide a relative URL (e.g. "/app"), which
  // `new URL(req.url)` rejects. Provide a base to support both absolute and relative.
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

export const app = api.raw(
  { expose: true, method: "GET", path: "/app" },
  handleFrontendRequest
);

export const appHead = api.raw(
  { expose: true, method: "HEAD", path: "/app" },
  handleFrontendRequest
);

export const appWildcard = api.raw(
  { expose: true, method: "GET", path: "/app/*path" },
  handleFrontendRequest
);

export const appWildcardHead = api.raw(
  { expose: true, method: "HEAD", path: "/app/*path" },
  handleFrontendRequest
);

