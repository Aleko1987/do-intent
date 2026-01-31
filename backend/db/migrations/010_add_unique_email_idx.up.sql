-- Adds the unique index needed for email upserts / dedupe
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_email
ON marketing_leads (lower(email))
WHERE email IS NOT NULL;