import { api } from "encore.dev/api";

interface HealthResponse {
  ok: true;
}

export const healthz = api<void, HealthResponse>(
  { expose: true, method: "GET", path: "/healthz" },
  async () => ({ ok: true })
);
