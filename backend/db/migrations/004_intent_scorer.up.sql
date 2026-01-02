-- Intent Scores table
CREATE TABLE intent_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_event_id UUID NOT NULL REFERENCES intent_events(id) ON DELETE CASCADE UNIQUE,
  score NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.7,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_version TEXT NOT NULL DEFAULT 'rules_v1',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intent_scores_event ON intent_scores (intent_event_id);
CREATE INDEX idx_intent_scores_score ON intent_scores (score DESC);

-- Lead Intent Rollups table
CREATE TABLE lead_intent_rollups (
  lead_id UUID PRIMARY KEY REFERENCES marketing_leads(id) ON DELETE CASCADE,
  score_7d NUMERIC NOT NULL DEFAULT 0,
  score_30d NUMERIC NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_intent_rollups_score_7d ON lead_intent_rollups (score_7d DESC);
CREATE INDEX idx_lead_intent_rollups_score_30d ON lead_intent_rollups (score_30d DESC);

-- Intent Rules table (for storing configurable scoring modifiers)
CREATE TABLE intent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT UNIQUE NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('base_score', 'modifier')),
  event_type TEXT NULL,
  modifier_condition JSONB NULL,
  points NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intent_rules_active ON intent_rules (is_active);
CREATE INDEX idx_intent_rules_type ON intent_rules (rule_type);

-- Insert default base scores
INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description) VALUES
  ('base_post_published', 'base_score', 'post_published', 1, 'Post published event'),
  ('base_link_clicked', 'base_score', 'link_clicked', 5, 'Link clicked event'),
  ('base_inbound_message', 'base_score', 'inbound_message', 8, 'Inbound message event'),
  ('base_quote_requested', 'base_score', 'quote_requested', 15, 'Quote requested event'),
  ('base_meeting_booked', 'base_score', 'meeting_booked', 20, 'Meeting booked event'),
  ('base_purchase_made', 'base_score', 'purchase_made', 50, 'Purchase made event');

-- Insert default modifiers
INSERT INTO intent_rules (rule_key, rule_type, modifier_condition, points, description) VALUES
  ('mod_utm_social', 'modifier', '{"utm_medium": "social"}', 1, 'UTM medium is social'),
  ('mod_high_reach', 'modifier', '{"reach_gte": 5000}', 2, 'Reach over 5000');
