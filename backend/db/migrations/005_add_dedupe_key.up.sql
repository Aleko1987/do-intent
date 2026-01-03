ALTER TABLE intent_events ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX idx_intent_events_dedupe ON intent_events (event_source, dedupe_key) WHERE dedupe_key IS NOT NULL;
