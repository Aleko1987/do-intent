import { api } from "encore.dev/api";

interface HealthRequest {
  q?: string;
}

interface HealthResponse {
  ok: true;
}

interface RootResponse {
  ok: boolean;
  service: string;
  ts: string;
}

export const healthz = api<HealthRequest, HealthResponse>(
  { expose: true, method: "GET", path: "/healthz" },
  async () => ({ ok: true })
);

export const root = api<HealthRequest, RootResponse>(
  { expose: true, method: "GET", path: "/", auth: false },
  async (): Promise<RootResponse> => {
    return {
      ok: true,
      service: "do-intent",
      ts: new Date().toISOString(),
    };
  }
);
