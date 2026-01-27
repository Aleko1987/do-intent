ALTER TABLE intent_events
  ADD COLUMN IF NOT EXISTS anonymous_id TEXT;

ALTER TABLE intent_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE INDEX IF NOT EXISTS idx_intent_events_dedupe_key
  ON intent_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intent_events_anonymous_id
  ON intent_events (anonymous_id)
  WHERE anonymous_id IS NOT NULL;
