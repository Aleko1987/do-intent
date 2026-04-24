CREATE TABLE IF NOT EXISTS social_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  lead_id UUID NULL REFERENCES marketing_leads(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'whatsapp')),
  external_profile_ref TEXT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 50,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_watchlists_owner_platform_ref
  ON social_watchlists (owner_user_id, platform, external_profile_ref);

CREATE INDEX IF NOT EXISTS idx_social_watchlists_owner_enabled_priority
  ON social_watchlists (owner_user_id, enabled, priority DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS inbox_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'whatsapp')),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('inbound_message', 'comment', 'reply', 'mention', 'post_activity', 'profile_activity')
  ),
  task_type TEXT NOT NULL CHECK (task_type IN ('like', 'comment', 'reply', 'dm')),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'approved', 'rejected', 'executing', 'executed', 'failed', 'blocked', 'unsupported')
  ) DEFAULT 'pending',
  priority SMALLINT NOT NULL DEFAULT 50,
  lead_id UUID NULL REFERENCES marketing_leads(id) ON DELETE SET NULL,
  actor_ref TEXT NOT NULL,
  actor_display TEXT NULL,
  target_ref TEXT NOT NULL,
  source_url TEXT NULL,
  content_excerpt TEXT NULL,
  suggested_reply TEXT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_at TIMESTAMPTZ NULL,
  approved_by_user_id TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  executed_by_user_id TEXT NULL,
  executed_at TIMESTAMPTZ NULL,
  rejected_by_user_id TEXT NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_tasks_owner_status_priority_due
  ON inbox_tasks (owner_user_id, status, priority DESC, due_at ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_tasks_owner_platform_status
  ON inbox_tasks (owner_user_id, platform, status, created_at DESC);

CREATE TABLE IF NOT EXISTS action_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'whatsapp')),
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'comment', 'reply', 'dm')),
  budget_date DATE NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  cap_count INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, platform, action_type, budget_date)
);

CREATE TABLE IF NOT EXISTS execution_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES inbox_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'blocked', 'unsupported')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_attempts_owner_task_time
  ON execution_attempts (owner_user_id, task_id, attempted_at DESC);
