-- Marketing Leads table
CREATE TABLE marketing_leads (
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

CREATE UNIQUE INDEX idx_marketing_leads_email ON marketing_leads (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_marketing_leads_owner ON marketing_leads (owner_user_id);
CREATE INDEX idx_marketing_leads_stage ON marketing_leads (marketing_stage);
CREATE INDEX idx_marketing_leads_last_signal ON marketing_leads (last_signal_at);

-- Intent Events table
CREATE TABLE intent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_value INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intent_events_lead ON intent_events (lead_id);
CREATE INDEX idx_intent_events_occurred ON intent_events (occurred_at DESC);
CREATE INDEX idx_intent_events_type ON intent_events (event_type);

-- Scoring Rules table
CREATE TABLE scoring_rules (
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

-- Content Items table
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  creative_url TEXT,
  channels JSONB DEFAULT '[]'::jsonb,
  cta_type TEXT,
  target_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('draft', 'queued', 'scheduled', 'posted', 'failed')) DEFAULT 'draft',
  buffer_post_id TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_items_status ON content_items (status);
CREATE INDEX idx_content_items_scheduled ON content_items (scheduled_at);

-- Content Post Logs table
CREATE TABLE content_post_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  platform_response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_post_logs_item ON content_post_logs (content_item_id);
