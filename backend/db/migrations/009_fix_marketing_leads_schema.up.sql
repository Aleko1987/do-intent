ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS email TEXT NULL,
  ADD COLUMN IF NOT EXISTS company TEXT NULL,
  ADD COLUMN IF NOT EXISTS contact_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NULL,
  ADD COLUMN IF NOT EXISTS marketing_stage TEXT
    CHECK (marketing_stage IN ('M1','M2','M3','M4','M5'))
    DEFAULT 'M1',
  ADD COLUMN IF NOT EXISTS intent_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_signal_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_email
  ON marketing_leads (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_leads_owner
  ON marketing_leads (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_stage
  ON marketing_leads (marketing_stage);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_last_signal
  ON marketing_leads (last_signal_at);