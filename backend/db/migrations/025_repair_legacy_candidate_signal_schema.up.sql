-- Repair databases that applied the removed migration 023_create_candidate_signal_review_tables
-- before 023_create_candidate_signals_review_pipeline: the pipeline migration used
-- CREATE TABLE IF NOT EXISTS and never upgraded the thin schema. Drop legacy objects
-- when owner_user_id is missing, then recreate canonical tables (same as 023 + 024).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'candidate_signals'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'candidate_signals' AND column_name = 'owner_user_id'
  ) THEN
    DROP TABLE IF EXISTS candidate_signal_reviews CASCADE;
    DROP TABLE IF EXISTS candidate_signal_evidence CASCADE;
    DROP TABLE IF EXISTS candidate_signal_reminders CASCADE;
    DROP TABLE candidate_signals CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS candidate_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('facebook', 'instagram', 'whatsapp', 'email', 'website', 'manual_upload')),
  source_type TEXT NOT NULL CHECK (source_type IN ('api', 'webhook', 'website_tracker', 'manual', 'upload', 'operator')),
  source_ref TEXT NULL,
  external_account_ref TEXT NULL,
  lead_id UUID NULL REFERENCES marketing_leads(id) ON DELETE SET NULL,
  anonymous_id TEXT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('post_published', 'link_clicked', 'inbound_message', 'quote_requested', 'meeting_booked', 'purchase_made', 'other')),
  summary TEXT NULL,
  raw_text TEXT NULL,
  actor_display TEXT NULL,
  actor_handle TEXT NULL,
  identity_status TEXT NOT NULL CHECK (identity_status IN ('aggregate_only', 'deterministic', 'probable', 'unknown')) DEFAULT 'unknown',
  identity_confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  identity_key_hash TEXT NULL,
  suggested_event_type TEXT NULL CHECK (suggested_event_type IN ('post_published', 'link_clicked', 'inbound_message', 'quote_requested', 'meeting_booked', 'purchase_made', 'other')),
  suggested_intent_score NUMERIC(8,4) NULL,
  suggested_stage TEXT NULL CHECK (suggested_stage IN ('M1', 'M2', 'M3', 'M4', 'M5')),
  suggested_reason TEXT NULL,
  suggestion_confidence NUMERIC(5,4) NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected', 'promoted', 'needs_evidence')) DEFAULT 'pending_review',
  promoted_event_id UUID NULL REFERENCES intent_events(id) ON DELETE SET NULL,
  dedupe_key TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_signals_owner_channel_dedupe
  ON candidate_signals (owner_user_id, channel, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_signals_owner_status_occurred
  ON candidate_signals (owner_user_id, status, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_signals_lead
  ON candidate_signals (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_signals_identity_key_hash
  ON candidate_signals (identity_key_hash)
  WHERE identity_key_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS candidate_signal_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_signal_id UUID NOT NULL REFERENCES candidate_signals(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('screenshot', 'platform_export', 'url', 'manual_note', 'api_payload')),
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('external_url', 'internal_path', 'inline')),
  evidence_ref TEXT NOT NULL,
  mime_type TEXT NULL,
  sha256 TEXT NULL,
  captured_at TIMESTAMPTZ NULL,
  redaction_status TEXT NOT NULL CHECK (redaction_status IN ('not_required', 'pending', 'redacted')) DEFAULT 'not_required',
  is_sensitive BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_signal_evidence_signal
  ON candidate_signal_evidence (candidate_signal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_signal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_signal_id UUID NOT NULL REFERENCES candidate_signals(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'edit', 'merge', 'create_lead', 'promote')),
  decision_reason TEXT NULL,
  before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_event_type TEXT NULL CHECK (applied_event_type IN ('post_published', 'link_clicked', 'inbound_message', 'quote_requested', 'meeting_booked', 'purchase_made', 'other')),
  applied_stage TEXT NULL CHECK (applied_stage IN ('M1', 'M2', 'M3', 'M4', 'M5')),
  applied_intent_score NUMERIC(8,4) NULL,
  applied_lead_id UUID NULL REFERENCES marketing_leads(id) ON DELETE SET NULL,
  promoted_event_id UUID NULL REFERENCES intent_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_signal_reviews_signal
  ON candidate_signal_reviews (candidate_signal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_signal_reviews_reviewer
  ON candidate_signal_reviews (reviewer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_signal_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_signal_id UUID NOT NULL REFERENCES candidate_signals(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp')),
  template_text TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('initiated', 'sent', 'replied', 'closed')) DEFAULT 'initiated',
  sent_at TIMESTAMPTZ NULL,
  responded_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  last_updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_signal_reminders_signal_created
  ON candidate_signal_reminders (candidate_signal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_signal_reminders_owner_status
  ON candidate_signal_reminders (owner_user_id, delivery_status, created_at DESC);

ALTER TABLE candidate_signal_evidence
  ADD COLUMN IF NOT EXISTS reminder_id UUID NULL REFERENCES candidate_signal_reminders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_signal_evidence_reminder
  ON candidate_signal_evidence (reminder_id)
  WHERE reminder_id IS NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'candidate_signals'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status IN%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE candidate_signals DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE candidate_signals
  DROP CONSTRAINT IF EXISTS candidate_signals_status_check;

ALTER TABLE candidate_signals
  ADD CONSTRAINT candidate_signals_status_check
  CHECK (status IN (
    'pending_review',
    'approved',
    'rejected',
    'promoted',
    'needs_evidence',
    'reminder_sent',
    'evidence_attached'
  ));
