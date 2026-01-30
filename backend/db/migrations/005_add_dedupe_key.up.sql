DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='intent_events' AND column_name='dedupe_key'
  ) THEN
    ALTER TABLE intent_events ADD COLUMN dedupe_key TEXT;
  END IF;

  -- Create index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_intent_events_dedupe'
  ) THEN
    CREATE UNIQUE INDEX idx_intent_events_dedupe ON intent_events (event_source, dedupe_key) WHERE dedupe_key IS NOT NULL;
  END IF;
END $$;
