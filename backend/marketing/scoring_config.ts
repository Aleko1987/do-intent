import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";

export interface LeadScoringConfig {
  m1_min: number;
  m2_min: number;
  m3_min: number;
  m4_min: number;
  m5_min: number;
  auto_push_threshold: number;
  decay_points_per_week: number;
}

interface ScoringConfigRow extends LeadScoringConfig {
  id: number;
  updated_at: string;
}

interface EmptyRequest {
  dummy?: string;
}

type UpdateScoringConfigRequest = Partial<LeadScoringConfig>;

export const DEFAULT_SCORING_CONFIG: LeadScoringConfig = {
  m1_min: 0,
  m2_min: 6,
  m3_min: 16,
  m4_min: 31,
  m5_min: 46,
  auto_push_threshold: 31,
  decay_points_per_week: 1,
};

const CONFIG_FIELDS: Array<keyof LeadScoringConfig> = [
  "m1_min",
  "m2_min",
  "m3_min",
  "m4_min",
  "m5_min",
  "auto_push_threshold",
  "decay_points_per_week",
];

async function ensureConfigRowExists(): Promise<void> {
  await db.rawExec(
    `
      INSERT INTO lead_scoring_config (
        id, m1_min, m2_min, m3_min, m4_min, m5_min, auto_push_threshold, decay_points_per_week, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (id) DO NOTHING
    `,
    1,
    DEFAULT_SCORING_CONFIG.m1_min,
    DEFAULT_SCORING_CONFIG.m2_min,
    DEFAULT_SCORING_CONFIG.m3_min,
    DEFAULT_SCORING_CONFIG.m4_min,
    DEFAULT_SCORING_CONFIG.m5_min,
    DEFAULT_SCORING_CONFIG.auto_push_threshold,
    DEFAULT_SCORING_CONFIG.decay_points_per_week
  );
}

function toResponse(row: ScoringConfigRow | null): LeadScoringConfig {
  if (!row) {
    return { ...DEFAULT_SCORING_CONFIG };
  }

  return {
    m1_min: row.m1_min,
    m2_min: row.m2_min,
    m3_min: row.m3_min,
    m4_min: row.m4_min,
    m5_min: row.m5_min,
    auto_push_threshold: row.auto_push_threshold,
    decay_points_per_week: row.decay_points_per_week,
  };
}

function validateConfig(config: LeadScoringConfig): void {
  for (const field of CONFIG_FIELDS) {
    const value = config[field];
    if (!Number.isInteger(value) || value < 0) {
      throw APIError.invalidArgument(`${field} must be a non-negative integer`);
    }
  }

  if (
    config.m1_min > config.m2_min ||
    config.m2_min > config.m3_min ||
    config.m3_min > config.m4_min ||
    config.m4_min > config.m5_min
  ) {
    throw APIError.invalidArgument("stage minimums must be in ascending order (M1 <= M2 <= M3 <= M4 <= M5)");
  }
}

async function getStoredConfigRow(): Promise<ScoringConfigRow | null> {
  return await db.rawQueryRow<ScoringConfigRow>(
    `
      SELECT
        id,
        m1_min,
        m2_min,
        m3_min,
        m4_min,
        m5_min,
        auto_push_threshold,
        decay_points_per_week,
        updated_at
      FROM lead_scoring_config
      WHERE id = 1
    `
  );
}

export async function readLeadScoringConfig(): Promise<LeadScoringConfig> {
  try {
    await ensureConfigRowExists();
    const row = await getStoredConfigRow();
    return toResponse(row);
  } catch (error) {
    const pgError = error as { code?: string };
    const isMissingTable = pgError?.code === "42P01";
    if (isMissingTable) {
      console.warn("[marketing.scoring_config] table missing, using defaults");
      return { ...DEFAULT_SCORING_CONFIG };
    }
    throw error;
  }
}

// Returns the active lead scoring qualification configuration.
export const getScoringConfig = api<EmptyRequest, LeadScoringConfig>(
  { expose: true, method: "GET", path: "/marketing/scoring-config", auth: true },
  async () => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    return await readLeadScoringConfig();
  }
);

// Updates the lead scoring qualification configuration.
export const updateScoringConfig = api<UpdateScoringConfigRequest, LeadScoringConfig>(
  { expose: true, method: "PATCH", path: "/marketing/scoring-config", auth: true },
  async (req) => {
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("missing auth context");
    }

    const hasAnyUpdate = CONFIG_FIELDS.some((field) => req[field] !== undefined);
    if (!hasAnyUpdate) {
      throw APIError.invalidArgument("no scoring config fields provided");
    }

    const current = await readLeadScoringConfig();
    const merged: LeadScoringConfig = {
      ...current,
      ...req,
    };

    validateConfig(merged);

    await db.rawExec(
      `
        UPDATE lead_scoring_config
        SET
          m1_min = $1,
          m2_min = $2,
          m3_min = $3,
          m4_min = $4,
          m5_min = $5,
          auto_push_threshold = $6,
          decay_points_per_week = $7,
          updated_at = now()
        WHERE id = 1
      `,
      merged.m1_min,
      merged.m2_min,
      merged.m3_min,
      merged.m4_min,
      merged.m5_min,
      merged.auto_push_threshold,
      merged.decay_points_per_week
    );

    console.info("[marketing.update_scoring_config] config updated", {
      uid: authData.userID,
      updated_fields: CONFIG_FIELDS.filter((field) => req[field] !== undefined),
    });

    return merged;
  }
);
