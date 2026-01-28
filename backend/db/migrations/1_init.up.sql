-- Marketing Leads table
CREATE TABLE IF NOT EXISTS marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  source_type TEXT CHECK (source_type IN ('apollo', 'website', 'referral', 'manual', 'other')),
  apollo_lead_id TEXT,
  marketing_stage TEXT CHECK (marketing_stage IN ('M1', 'M2', 'M3', 'M4', 'M5')) DEFAULT 'M1',
  intent_score INTEGER DEFAULT 0,
  last_signal_at TIMESTAMPTZ,
  owner_user_id TEXT NOT NULL,
  auto_push_enabled BOOLEAN DEFAULT true,
  sales_customer_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_email ON marketing_leads (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_owner ON marketing_leads (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_stage ON marketing_leads (marketing_stage);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_last_signal ON marketing_leads (last_signal_at);

-- Intent Events table
CREATE TABLE IF NOT EXISTS intent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES marketing_leads(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_value INTEGER DEFAULT 0,
  dedupe_key TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_events_lead ON intent_events (lead_id);
CREATE INDEX IF NOT EXISTS idx_intent_events_occurred ON intent_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_events_type ON intent_events (event_type);
CREATE INDEX IF NOT EXISTS idx_intent_events_dedupe_key ON intent_events (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intent_events_anonymous_id ON intent_events (anonymous_id) WHERE anonymous_id IS NOT NULL;

-- Scoring Rules table
CREATE TABLE IF NOT EXISTS scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT,
  event_type TEXT UNIQUE NOT NULL,
  points INTEGER DEFAULT 0,
  is_hard_intent BOOLEAN DEFAULT false,
  stage_hint TEXT CHECK (stage_hint IN ('M1', 'M2', 'M3', 'M4', 'M5')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

