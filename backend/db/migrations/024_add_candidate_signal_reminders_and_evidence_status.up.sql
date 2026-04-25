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
