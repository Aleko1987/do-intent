ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS anonymous_id TEXT,
  ADD COLUMN IF NOT EXISTS clerk_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_leads_anonymous_id_unique_idx
  ON marketing_leads (anonymous_id)
  WHERE anonymous_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_leads_clerk_id_unique_idx
  ON marketing_leads (clerk_id)
  WHERE clerk_id IS NOT NULL;
