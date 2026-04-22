-- Candidate Signal Review Queue tables
-- Supports assisted human-in-the-loop review before promoting to canonical intent events.

CREATE TABLE IF NOT EXISTS candidate_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES marketing_leads(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (
    channel IN ('facebook', 'instagram', 'whatsapp', 'email', 'website', 'manual_upload', 'other')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'needs_evidence', 'ready_for_review', 'approved', 'rejected')
  ),
  actor_display TEXT,
  actor_handle TEXT,
  actor_contact TEXT,
  source_ref TEXT,
  summary TEXT,
  raw_text TEXT,
  suggested_event_type TEXT DEFAULT 'other',
  suggested_intent_score NUMERIC(5, 2),
  suggestion_confidence NUMERIC(5, 2),
  suggested_stage TEXT CHECK (suggested_stage IN ('M1', 'M2', 'M3', 'M4', 'M5')),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  latest_reminder_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_signals_status_created
  ON candidate_signals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_signals_channel_created
  ON candidate_signals (channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_signals_lead_created
  ON candidate_signals (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_signal_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_signal_id UUID NOT NULL REFERENCES candidate_signals(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'other')),
  template_text TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'drafted' CHECK (
    delivery_status IN ('drafted', 'opened', 'sent', 'delivered', 'failed')
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_signal_reminders_signal_created
  ON candidate_signal_reminders (candidate_signal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_signal_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_signal_id UUID NOT NULL REFERENCES candidate_signals(id) ON DELETE CASCADE,
  reminder_id UUID REFERENCES candidate_signal_reminders(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL DEFAULT 'screenshot' CHECK (
    evidence_type IN ('screenshot', 'url', 'document', 'other')
  ),
  storage_kind TEXT NOT NULL CHECK (
    storage_kind IN ('inline', 'external_url', 'internal_path', 'other')
  ),
  evidence_ref TEXT NOT NULL,
  mime_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_signal_evidence_signal_created
  ON candidate_signal_evidence (candidate_signal_id, created_at DESC);
