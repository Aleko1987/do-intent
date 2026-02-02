import { api } from "encore.dev/api";
import { GIT_SHA, BUILD_TIME } from "../version";

interface HealthResponse {
  ok: true;
}

interface RootResponse {
  ok: boolean;
  service: string;
  ts: string;
}

interface VersionResponse {
  gitSha: string;
  buildTime: string;
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

export const version = api<void, VersionResponse>(
  { expose: true, method: "GET", path: "/health/version", auth: false },
  async (): Promise<VersionResponse> => {
    return {
      gitSha: GIT_SHA,
      buildTime: BUILD_TIME,
    };
  }
);
