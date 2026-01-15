import { api } from "encore.dev/api";

interface EnvResponse {
  hasEncoreSecretIngestApiKey: boolean;
  hasEncoreSecretClerkSecretKey: boolean;
  hasIngestApiKeyPlain: boolean;
  nodeEnv: string | null;
  keysPresent: string[];
}

export const env = api<void, EnvResponse>(
  { expose: true, method: "GET", path: "/debug/env" },
  async (): Promise<EnvResponse> => {
    // Check for ENCORE_SECRET_IngestApiKey
    const hasEncoreSecretIngestApiKey =
      !!process.env.ENCORE_SECRET_IngestApiKey &&
      process.env.ENCORE_SECRET_IngestApiKey.trim() !== "";

    // Check for ENCORE_SECRET_ClerkSecretKey
    const hasEncoreSecretClerkSecretKey =
      !!process.env.ENCORE_SECRET_ClerkSecretKey &&
      process.env.ENCORE_SECRET_ClerkSecretKey.trim() !== "";

    // Check for INGEST_API_KEY
    const hasIngestApiKeyPlain =
      !!process.env.INGEST_API_KEY && process.env.INGEST_API_KEY.trim() !== "";

    // Get NODE_ENV or null
    const nodeEnv = process.env.NODE_ENV || null;

    // Get all env keys matching the pattern /ENCORE_SECRET|INGEST|CLERK/
    const envPattern = /ENCORE_SECRET|INGEST|CLERK/;
    const keysPresent = Object.keys(process.env).filter((key) =>
      envPattern.test(key)
    );

    return {
      hasEncoreSecretIngestApiKey,
      hasEncoreSecretClerkSecretKey,
      hasIngestApiKeyPlain,
      nodeEnv,
      keysPresent,
    };
  }
);

