ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS ip_raw TEXT,
  ADD COLUMN IF NOT EXISTS ip_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_events_ip_fingerprint_occurred
  ON events (ip_fingerprint, occurred_at DESC)
  WHERE ip_fingerprint IS NOT NULL;

ALTER TABLE IF EXISTS intent_events
  ADD COLUMN IF NOT EXISTS ip_raw TEXT,
  ADD COLUMN IF NOT EXISTS ip_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_intent_events_ip_fingerprint_occurred
  ON intent_events (ip_fingerprint, occurred_at DESC)
  WHERE ip_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS intent_ip_fingerprint_scores (
  ip_fingerprint TEXT PRIMARY KEY,
  ip_raw TEXT NULL,
  total_events BIGINT NOT NULL DEFAULT 0,
  boost_score_total INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_ip_fingerprint_scores_last_seen
  ON intent_ip_fingerprint_scores (last_seen_at DESC);

ALTER TABLE IF EXISTS lead_scoring_config
  ADD COLUMN IF NOT EXISTS ip_boost_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ip_repeat_boost_points INTEGER NOT NULL DEFAULT 2;

UPDATE lead_scoring_config
SET
  ip_boost_enabled = COALESCE(ip_boost_enabled, true),
  ip_repeat_boost_points = COALESCE(ip_repeat_boost_points, 2),
  updated_at = now()
WHERE id = 1;
