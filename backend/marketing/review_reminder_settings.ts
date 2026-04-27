import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../db/db";

export type ReviewReminderFrequencyUnit = "daily" | "weekly";
export type ReviewReminderMobileChannel = "whatsapp" | "email";

export interface ReviewReminderSettings {
  enabled: boolean;
  frequency_unit: ReviewReminderFrequencyUnit;
  frequency_interval: number;
  weekly_day: number;
  reminder_time: string;
  timezone: string;
  mobile_channel: ReviewReminderMobileChannel;
  next_reminder_at: string | null;
  last_notified_at: string | null;
}

interface ReviewReminderSettingsRow extends ReviewReminderSettings {
  id: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

interface EmptyRequest {
  dummy?: string;
}

type UpdateReviewReminderSettingsRequest = Partial<
  Omit<ReviewReminderSettings, "next_reminder_at" | "last_notified_at">
>;

const DEFAULT_SETTINGS: ReviewReminderSettings = {
  enabled: false,
  frequency_unit: "weekly",
  frequency_interval: 1,
  weekly_day: 1,
  reminder_time: "09:00",
  timezone: "UTC",
  mobile_channel: "whatsapp",
  next_reminder_at: null,
  last_notified_at: null,
};

function requireUserId(): string {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("missing auth context");
  }
  return authData.userID;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function normalizeSettings(input: ReviewReminderSettings): ReviewReminderSettings {
  if (!Number.isInteger(input.frequency_interval) || input.frequency_interval < 1 || input.frequency_interval > 30) {
    throw APIError.invalidArgument("frequency_interval must be an integer between 1 and 30");
  }
  if (!Number.isInteger(input.weekly_day) || input.weekly_day < 0 || input.weekly_day > 6) {
    throw APIError.invalidArgument("weekly_day must be an integer between 0 and 6");
  }
  if (input.frequency_unit !== "daily" && input.frequency_unit !== "weekly") {
    throw APIError.invalidArgument("frequency_unit must be daily or weekly");
  }
  if (input.mobile_channel !== "whatsapp" && input.mobile_channel !== "email") {
    throw APIError.invalidArgument("mobile_channel must be whatsapp or email");
  }
  if (!isValidTime(input.reminder_time)) {
    throw APIError.invalidArgument("reminder_time must be HH:MM (24h)");
  }
  if (!input.timezone || input.timezone.trim().length === 0) {
    throw APIError.invalidArgument("timezone is required");
  }
  return {
    ...input,
    timezone: input.timezone.trim(),
  };
}

function computeNextReminderAtUtc(settings: ReviewReminderSettings, fromDate: Date): string | null {
  if (!settings.enabled) {
    return null;
  }

  const [hour, minute] = settings.reminder_time.split(":").map((value) => Number(value));
  const base = new Date(fromDate);
  base.setUTCHours(hour, minute, 0, 0);

  if (settings.frequency_unit === "daily") {
    if (base <= fromDate) {
      base.setUTCDate(base.getUTCDate() + settings.frequency_interval);
    }
    return base.toISOString();
  }

  const targetWeekday = settings.weekly_day;
  const currentWeekday = base.getUTCDay();
  let deltaDays = targetWeekday - currentWeekday;
  if (deltaDays < 0) {
    deltaDays += 7;
  }
  base.setUTCDate(base.getUTCDate() + deltaDays);
  if (base <= fromDate) {
    base.setUTCDate(base.getUTCDate() + 7 * settings.frequency_interval);
  }
  return base.toISOString();
}

async function ensureSettingsRow(ownerUserId: string): Promise<void> {
  const nextReminderAt = computeNextReminderAtUtc(DEFAULT_SETTINGS, new Date());
  await db.rawExec(
    `
      INSERT INTO review_queue_reminder_settings (
        owner_user_id,
        enabled,
        frequency_unit,
        frequency_interval,
        weekly_day,
        reminder_time,
        timezone,
        mobile_channel,
        next_reminder_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      ON CONFLICT (owner_user_id) DO NOTHING
    `,
    ownerUserId,
    DEFAULT_SETTINGS.enabled,
    DEFAULT_SETTINGS.frequency_unit,
    DEFAULT_SETTINGS.frequency_interval,
    DEFAULT_SETTINGS.weekly_day,
    DEFAULT_SETTINGS.reminder_time,
    DEFAULT_SETTINGS.timezone,
    DEFAULT_SETTINGS.mobile_channel,
    nextReminderAt
  );
}

async function getSettingsRow(ownerUserId: string): Promise<ReviewReminderSettingsRow> {
  await ensureSettingsRow(ownerUserId);
  const row = await db.rawQueryRow<ReviewReminderSettingsRow>(
    `
      SELECT *
      FROM review_queue_reminder_settings
      WHERE owner_user_id = $1
      LIMIT 1
    `,
    ownerUserId
  );
  if (!row) {
    throw APIError.internal("failed to load review reminder settings");
  }
  return row;
}

function toResponse(row: ReviewReminderSettingsRow): ReviewReminderSettings {
  return {
    enabled: row.enabled,
    frequency_unit: row.frequency_unit,
    frequency_interval: row.frequency_interval,
    weekly_day: row.weekly_day,
    reminder_time: row.reminder_time,
    timezone: row.timezone,
    mobile_channel: row.mobile_channel,
    next_reminder_at: row.next_reminder_at,
    last_notified_at: row.last_notified_at,
  };
}

export const getReviewReminderSettings = api<EmptyRequest, ReviewReminderSettings>(
  { expose: true, method: "GET", path: "/marketing/review-reminder-settings", auth: true },
  async () => {
    const ownerUserId = requireUserId();
    const row = await getSettingsRow(ownerUserId);
    return toResponse(row);
  }
);

export const updateReviewReminderSettings = api<
  UpdateReviewReminderSettingsRequest,
  ReviewReminderSettings
>(
  { expose: true, method: "PATCH", path: "/marketing/review-reminder-settings", auth: true },
  async (req) => {
    const ownerUserId = requireUserId();
    const existing = await getSettingsRow(ownerUserId);

    const merged = normalizeSettings({
      ...toResponse(existing),
      ...req,
    });
    const nextReminderAt = computeNextReminderAtUtc(merged, new Date());

    const updated = await db.rawQueryRow<ReviewReminderSettingsRow>(
      `
        UPDATE review_queue_reminder_settings
        SET
          enabled = $2,
          frequency_unit = $3,
          frequency_interval = $4,
          weekly_day = $5,
          reminder_time = $6,
          timezone = $7,
          mobile_channel = $8,
          next_reminder_at = $9,
          updated_at = now()
        WHERE owner_user_id = $1
        RETURNING *
      `,
      ownerUserId,
      merged.enabled,
      merged.frequency_unit,
      merged.frequency_interval,
      merged.weekly_day,
      merged.reminder_time,
      merged.timezone,
      merged.mobile_channel,
      nextReminderAt
    );

    if (!updated) {
      throw APIError.internal("failed to update review reminder settings");
    }
    return toResponse(updated);
  }
);
