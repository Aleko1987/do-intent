export interface CompanionConfig {
  intakeBaseUrl: string;
  intakeToken: string;
  ownerUserId: string;
  defaultChannel: string;
  defaultSignalType: string;
  captureAllMonitors: boolean;
  doublePressWindowMs: number;
  holdThresholdMs: number;
  maxImageBytes: number;
  workstationId: string | null;
  appVersion: string | null;
}

function parseNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.trim().toLowerCase() === "true";
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): CompanionConfig {
  return {
    intakeBaseUrl: required("DO_INTENT_CAPTURE_BASE_URL"),
    intakeToken: required("DO_INTENT_CAPTURE_TOKEN"),
    ownerUserId: required("DO_INTENT_OWNER_USER_ID"),
    defaultChannel: process.env.DO_INTENT_CAPTURE_CHANNEL?.trim() || "manual_upload",
    defaultSignalType: process.env.DO_INTENT_CAPTURE_SIGNAL_TYPE?.trim() || "other",
    captureAllMonitors: parseBoolean("DO_INTENT_CAPTURE_ALL_MONITORS", false),
    doublePressWindowMs: parseNumber("DO_INTENT_DOUBLE_PRESS_MS", 350),
    holdThresholdMs: parseNumber("DO_INTENT_HOLD_THRESHOLD_MS", 180),
    maxImageBytes: parseNumber("DO_INTENT_CAPTURE_MAX_BYTES", 4 * 1024 * 1024),
    workstationId: process.env.DO_INTENT_WORKSTATION_ID?.trim() || null,
    appVersion: process.env.DO_INTENT_CAPTURE_APP_VERSION?.trim() || "1.0.0",
  };
}
