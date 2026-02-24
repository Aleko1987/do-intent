import type { JsonObject } from "../internal/json_types";

export interface MarketingLead {
  id: string;
  company?: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  anonymous_id?: string | null;
  display_name?: string | null;
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
  metadata: JsonObject;
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
