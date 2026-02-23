ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS company_name TEXT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketing_leads'
      AND column_name = 'company'
  ) THEN
    UPDATE marketing_leads
    SET company_name = company
    WHERE company_name IS NULL
      AND company IS NOT NULL;
  END IF;
END $$;
