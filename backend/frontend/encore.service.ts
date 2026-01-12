
import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";

export default new Service("frontend");

export const assets = api.static({
  path: "/frontend/*path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});

interface HealthResponse {
  ok: boolean;
  service: string;
  ts: string;
}

export const health = api<void, HealthResponse>(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<HealthResponse> => {
    return {
      ok: true,
      service: "do-intent",
      ts: new Date().toISOString(),
    };
  }
);