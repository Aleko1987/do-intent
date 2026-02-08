import { api } from "encore.dev/api";

interface PingResponse {
  ok: boolean;
  service: string;
  ts: string;
}

export const ping = api<{}, PingResponse>(
  { expose: true, method: "GET", path: "/intent-scorer/ping" },
  async (): Promise<PingResponse> => {
    return {
      ok: true,
      service: "intent_scorer",
      ts: new Date().toISOString(),
    };
  }
);

