CREATE TABLE IF NOT EXISTS review_queue_reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency_unit TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency_unit IN ('daily', 'weekly')),
  frequency_interval INTEGER NOT NULL DEFAULT 1 CHECK (frequency_interval >= 1 AND frequency_interval <= 30),
  weekly_day SMALLINT NOT NULL DEFAULT 1 CHECK (weekly_day >= 0 AND weekly_day <= 6),
  reminder_time TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  mobile_channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (mobile_channel IN ('whatsapp', 'email')),
  next_reminder_at TIMESTAMPTZ NULL,
  last_notified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_queue_reminder_settings_owner
  ON review_queue_reminder_settings (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_review_queue_reminder_settings_next
  ON review_queue_reminder_settings (enabled, next_reminder_at);
