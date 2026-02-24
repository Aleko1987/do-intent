-- Ensure unique indexes exist for identify upsert conflict targets.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'marketing_leads'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX% ON public.marketing_leads USING btree (owner_user_id, lower(email)) WHERE (email IS NOT NULL)%'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_owner_lower_email_unique
      ON marketing_leads (owner_user_id, lower(email))
      WHERE email IS NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'marketing_leads'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX% ON public.marketing_leads USING btree (owner_user_id, anonymous_id) WHERE (anonymous_id IS NOT NULL)%'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_owner_anonymous_id_unique
      ON marketing_leads (owner_user_id, anonymous_id)
      WHERE anonymous_id IS NOT NULL;
  END IF;
END
$$;
