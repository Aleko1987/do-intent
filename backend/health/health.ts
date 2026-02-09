import { api } from "encore.dev/api";

interface HealthRequest {
  q?: string;
}

interface HealthResponse {
  ok: true;
}

export const healthz = api<HealthRequest, HealthResponse>(
  { expose: true, method: "GET", path: "/healthz" },
  async () => ({ ok: true })
);
