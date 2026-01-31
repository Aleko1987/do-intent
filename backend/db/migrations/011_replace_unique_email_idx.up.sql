-- Replace partial unique index with a plain unique index so ON CONFLICT (lower(email)) works
DROP INDEX IF EXISTS idx_marketing_leads_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_email
ON marketing_leads (lower(email));