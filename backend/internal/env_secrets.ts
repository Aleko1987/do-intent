const getTrimmedEnv = (key: string): string | null => {
  const value = process.env[key];
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveFirstEnv = (keys: string[]): string | null => {
  for (const key of keys) {
    const value = getTrimmedEnv(key);
    if (value) {
      return value;
    }
  }
  return null;
};

export function resolveIngestApiKey(): string | null {
  return resolveFirstEnv([
    "ENCORE_SECRET_IngestApiKey",
    "ENCORE_SECRET_INGEST_API_KEY",
    "INGEST_API_KEY",
    "IngestApiKey",
  ]);
}

export function resolveClerkSecretKey(): string | null {
  return resolveFirstEnv([
    "ENCORE_SECRET_ClerkSecretKey",
    "ENCORE_SECRET_CLERK_SECRET_KEY",
    "CLERK_SECRET_KEY",
    "ClerkSecretKey",
  ]);
}
