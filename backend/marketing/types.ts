export interface MarketingLead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source_type: string | null;
  apollo_lead_id: string | null;
  marketing_stage: string;
  intent_score: number;
  last_signal_at: string | null;
  owner_user_id: string;
  auto_push_enabled: boolean;
  sales_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntentEvent {
  id: string;
  lead_id: string | null;
  anonymous_id: string | null;
  event_type: string;
  event_source: string;
  event_value: number;
  dedupe_key: string | null;
  metadata: Record<string, any>;
  occurred_at: string;
  created_at: string;
}

export interface ScoringRule {
  id: string;
  rule_name: string | null;
  event_type: string;
  points: number;
  is_hard_intent: boolean;
  stage_hint: string | null;
  is_active: boolean;
}

export interface LeadWithEvents extends MarketingLead {
  recent_events: IntentEvent[];
}
