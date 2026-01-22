import { api } from "encore.dev/api";

interface HealthResponse {
  ok: boolean;
  service: string;
  ts: string;
}

export const health = api<void, HealthResponse>(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<HealthResponse> => {
    return buildHealthResponse();
  }
);

export const ready = api<void, HealthResponse>(
  { expose: true, method: "GET", path: "/ready" },
  async (): Promise<HealthResponse> => {
    return buildHealthResponse();
  }
);

const buildHealthResponse = (): HealthResponse => {
  return {
    ok: true,
    service: "do-intent",
    ts: new Date().toISOString(),
  };
};
