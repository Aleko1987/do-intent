import { Service } from "encore.dev/service";
import { api } from "encore.dev/api";

export default new Service("frontend");

// Route A: Static route for bare /app (and /app/) that serves index.html
export const appRoot = api.static({
  path: "/app",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});

// Route B: Static wildcard route for /app/*path with SPA fallback
export const assets = api.static({
  path: "/app/*path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});