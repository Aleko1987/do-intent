export interface IntentScore {
  id: string;
  intent_event_id: string;
  score: number;
  confidence: number;
  reasons: string[];
  model_version: string;
  created_at: string;
}

export interface LeadIntentRollup {
  lead_id: string;
  score_7d: number;
  score_30d: number;
  last_event_at: string | null;
  updated_at: string;
}

export interface IntentRule {
  id: string;
  rule_key: string;
  rule_type: 'base_score' | 'modifier';
  event_type: string | null;
  modifier_condition: Record<string, any> | null;
  points: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoredEvent {
  event_id: string;
  lead_id: string | null;
  event_type: string;
  event_source: string;
  metadata: Record<string, any>;
  occurred_at: string;
  score: number;
  confidence: number;
  reasons: string[];
}

export interface EventFilters {
  source?: string;
  channel_key?: string;
  event_type?: string;
  from_date?: string;
  to_date?: string;
  lead_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ComputeScoreRequest {
  event_id: string;
}

export interface RecomputeScoresRequest {
  days?: number;
}

export interface UpdateRuleRequest {
  rule_key: string;
  points?: number;
  is_active?: boolean;
  description?: string;
}

export interface ScoreResult {
  score: number;
  confidence: number;
  reasons: string[];
}

export interface LeadRollupWithLead {
  lead_id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  score_7d: number;
  score_30d: number;
  last_event_at: string | null;
  top_signal: string | null;
}

export interface LeadRollupsRequest {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LeadRollupsResponse {
  leads: LeadRollupWithLead[];
  total: number;
}

export interface DailyScoreBucket {
  date: string;
  total_score: number;
}

export interface LeadTrendRequest {
  lead_id: string;
  days?: number;
}

export interface LeadTrendResponse {
  lead_id: string;
  buckets: DailyScoreBucket[];
}

export interface TopSignalEvent {
  event_id: string;
  event_type: string;
  event_source: string;
  occurred_at: string;
  score: number;
  reasons: string[];
}

export interface LeadTopSignalsRequest {
  lead_id: string;
  limit?: number;
}

export interface LeadTopSignalsResponse {
  lead_id: string;
  events: TopSignalEvent[];
}
