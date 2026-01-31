import { api } from "encore.dev/api";

interface HealthResponse {
  ok: true;
}

interface RootResponse {
  ok: boolean;
  service: string;
  ts: string;
}

export const healthz = api<void, HealthResponse>(
  { expose: true, method: "GET", path: "/healthz" },
  async () => ({ ok: true })
);

export const root = api<void, RootResponse>(
  { expose: true, method: "GET", path: "/", auth: false },
  async (): Promise<RootResponse> => {
    return {
      ok: true,
      service: "do-intent",
      ts: new Date().toISOString(),
    };
  }
);
