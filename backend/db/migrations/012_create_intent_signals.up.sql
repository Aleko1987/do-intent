CREATE TABLE IF NOT EXISTS intent_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
  anonymous_id TEXT NULL,
  identity_id UUID NULL REFERENCES identities(identity_id) ON DELETE SET NULL,
  band TEXT NOT NULL CHECK (band IN ('cold', 'warm', 'hot', 'critical')),
  score_7d NUMERIC NOT NULL DEFAULT 0,
  score_30d NUMERIC NOT NULL DEFAULT 0,
  last_event_id UUID NULL REFERENCES intent_events(id) ON DELETE SET NULL,
  last_event_type TEXT NULL,
  last_event_source TEXT NULL,
  last_event_at TIMESTAMPTZ NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_signals_lead_emitted
  ON intent_signals (lead_id, emitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_intent_signals_band
  ON intent_signals (band);

