CREATE TABLE IF NOT EXISTS social_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  lead_id UUID NULL REFERENCES marketing_leads(id) ON DELETE SET NULL,
  inbox_task_id UUID NOT NULL REFERENCES inbox_tasks(id) ON DELETE CASCADE,
  execution_attempt_id UUID NOT NULL REFERENCES execution_attempts(id) ON DELETE CASCADE,
  execution_idempotency_key TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'whatsapp')),
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'comment', 'reply', 'dm')),
  actor_ref TEXT NOT NULL,
  actor_display TEXT NULL,
  target_ref TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_activity_events_owner_task_idempotency
  ON social_activity_events (owner_user_id, inbox_task_id, execution_idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_activity_events_owner_execution_attempt
  ON social_activity_events (owner_user_id, execution_attempt_id);

CREATE INDEX IF NOT EXISTS idx_social_activity_events_owner_lead_time
  ON social_activity_events (owner_user_id, lead_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_activity_events_owner_task_time
  ON social_activity_events (owner_user_id, inbox_task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_score_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  lead_id UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('social_execution')),
  source_id UUID NOT NULL REFERENCES social_activity_events(id) ON DELETE CASCADE,
  inbox_task_id UUID NOT NULL REFERENCES inbox_tasks(id) ON DELETE CASCADE,
  execution_attempt_id UUID NOT NULL REFERENCES execution_attempts(id) ON DELETE CASCADE,
  score_rule_key TEXT NOT NULL,
  delta_points INTEGER NOT NULL,
  previous_score NUMERIC NULL,
  new_score NUMERIC NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by_user_id TEXT NULL,
  reason_code TEXT NOT NULL,
  reason_message TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_score_ledger_owner_source
  ON lead_score_ledger (owner_user_id, source_kind, source_id);

CREATE INDEX IF NOT EXISTS idx_lead_score_ledger_owner_lead_time
  ON lead_score_ledger (owner_user_id, lead_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_score_ledger_owner_task_time
  ON lead_score_ledger (owner_user_id, inbox_task_id, applied_at DESC);

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_facebook_like_executed', 1, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_facebook_like_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_facebook_comment_executed', 3, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_facebook_comment_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_facebook_reply_executed', 4, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_facebook_reply_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_facebook_dm_executed', 6, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_facebook_dm_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_instagram_like_executed', 1, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_instagram_like_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_instagram_comment_executed', 3, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_instagram_comment_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_instagram_reply_executed', 4, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_instagram_reply_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_instagram_dm_executed', 6, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_instagram_dm_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_whatsapp_reply_executed', 5, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_whatsapp_reply_executed');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'social_whatsapp_dm_executed', 7, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type = 'social_whatsapp_dm_executed');
