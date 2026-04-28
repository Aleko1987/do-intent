ALTER TABLE owner_contact_directory
  ADD COLUMN IF NOT EXISTS lead_probability_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE owner_contact_directory
  DROP CONSTRAINT IF EXISTS owner_contact_directory_lead_probability_score_check;

ALTER TABLE owner_contact_directory
  ADD CONSTRAINT owner_contact_directory_lead_probability_score_check
  CHECK (lead_probability_score >= 0 AND lead_probability_score <= 100);

CREATE TABLE IF NOT EXISTS marketing_lead_score_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  lead_id UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
  surname TEXT NULL,
  name TEXT NULL,
  handle TEXT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  score_delta NUMERIC(8,4) NOT NULL,
  new_score NUMERIC(8,4) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_lead_score_updates_owner_created
  ON marketing_lead_score_updates (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_lead_score_updates_lead_created
  ON marketing_lead_score_updates (lead_id, created_at DESC);
