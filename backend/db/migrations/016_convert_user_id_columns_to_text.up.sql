-- Clerk user IDs are opaque strings (for example, `user_...`) and not UUIDs.
-- Convert any UUID-typed user ID columns to TEXT so Clerk IDs can be stored safely.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketing_leads'
      AND column_name = 'owner_user_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE marketing_leads
      ALTER COLUMN owner_user_id TYPE TEXT USING owner_user_id::text;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'intent_events'
      AND column_name = 'owner_user_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE intent_events
      ALTER COLUMN owner_user_id TYPE TEXT USING owner_user_id::text;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_items'
      AND column_name = 'created_by_user_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE content_items
      ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::text;
  END IF;
END
$$;
