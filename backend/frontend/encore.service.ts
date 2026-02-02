import { Service } from "encore.dev/service";
import { api, RawRequest, RawResponse } from "encore.dev/api";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export default new Service("frontend");

// Route A: GET /app endpoint that serves index.html for SPA root
export const appRoot = api.raw(
  { expose: true, method: "GET", path: "/app" },
  async (req: RawRequest, resp: RawResponse) => {
    try {
      // Resolve dist/index.html relative to this file's directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const indexPath = join(__dirname, "dist", "index.html");
      
      const html = await readFile(indexPath, "utf-8");
      resp.statusCode = 200;
      resp.setHeader("Content-Type", "text/html; charset=utf-8");
      resp.end(html);
    } catch (error) {
      console.error("[frontend] Failed to serve index.html:", error);
      resp.statusCode = 500;
      resp.setHeader("Content-Type", "text/plain; charset=utf-8");
      resp.end("dist missing, run npm run build in backend");
    }
  }
);

// Route B: Static wildcard route for /app/*path with SPA fallback
export const assets = api.static({
  path: "/app/*path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});