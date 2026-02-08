import { api } from "encore.dev/api";
import type { EmptyRequest } from "../internal/empty_request";

interface PingResponse {
  ok: boolean;
  service: string;
  ts: string;
}

export const ping = api<EmptyRequest, PingResponse>(
  { expose: true, method: "GET", path: "/intent-scorer/ping" },
  async (): Promise<PingResponse> => {
    return {
      ok: true,
      service: "intent_scorer",
      ts: new Date().toISOString(),
    };
  }
);

