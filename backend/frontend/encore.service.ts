import { Service } from "encore.dev/service";
import { api } from "encore.dev/api";

export default new Service("frontend");

// Serve SPA from /app/* prefix
export const assets = api.static({
  path: "/app/*",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});