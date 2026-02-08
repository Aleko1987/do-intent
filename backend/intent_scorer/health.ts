import { api } from "encore.dev/api";

interface HealthResponse {
  ok: boolean;
  service: string;
  ts: string;
}

export const health = api<{}, HealthResponse>(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<HealthResponse> => {
    return buildHealthResponse();
  }
);

export const ready = api<{}, HealthResponse>(
  { expose: true, method: "GET", path: "/ready" },
  async (): Promise<HealthResponse> => {
    return buildHealthResponse();
  }
);

export const readyV1 = api<{}, HealthResponse>(
  { expose: true, method: "GET", path: "/api/v1/ready" },
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
