export type OwnerContactSource = "csv_upload" | "paste_text" | "api_refresh";
export type OwnerContactImportMode = "full_refresh" | "delta";
export type OwnerContactInputFormat = "csv" | "text";
export type OwnerContactPlatform =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "email"
  | "website"
  | "manual_upload"
  | "unknown";
export type OwnerContactScopeType = "workspace_owner" | "connected_account";

export type ResolverMatchMethod = "exact" | "prefix" | "fuzzy";
export type ResolverDecision = "resolved" | "ambiguous" | "unresolved";

export type LeadCandidateQualityFlag =
  | "llm_timeout"
  | "low_confidence"
  | "ocr_sparse"
  | "resolver_ambiguous"
  | "legacy_projection";

export type LeadCandidateIntentType =
  | "post_published"
  | "link_clicked"
  | "inbound_message"
  | "quote_requested"
  | "meeting_booked"
  | "purchase_made"
  | "other";

export interface LeadCandidateEvidenceSnippet {
  source: "ocr" | "llm" | "manual";
  text: string;
}

export interface ResolvedContactReference {
  contact_id: string;
  display_name: string;
  confidence: number;
  method: ResolverMatchMethod;
}

export interface LeadCandidateResolutionOption {
  contact_id: string;
  display_name: string;
  score: number;
  method: ResolverMatchMethod;
}

export interface LeadCandidateV2 {
  candidate_id: string;
  intent_type: LeadCandidateIntentType;
  confidence: number;
  evidence_snippets: LeadCandidateEvidenceSnippet[];
  next_action: "review" | "request_evidence" | "defer";
  reasons: string[];
  resolved_contact: ResolvedContactReference | null;
  resolution_candidates: LeadCandidateResolutionOption[];
}

export interface LeadCandidatesModelMeta {
  provider: string | null;
  model: string | null;
  prompt_version: string | null;
  schema_version: "v2";
  elapsed_ms: number | null;
  timeout_ms: number | null;
  fallback_used: boolean;
}

export interface ResolverMatchBreakdown {
  exact_name: number;
  exact_handle: number;
  exact_email: number;
  prefix_name: number;
  fuzzy_name: number;
  token_overlap: number;
}

export interface ResolverMatchAudit {
  contact_id: string;
  display_name: string;
  score: number;
  method: ResolverMatchMethod;
  feature_breakdown: ResolverMatchBreakdown;
}

export interface ResolverAuditV2 {
  version: "v2";
  strategy: "deterministic_token_similarity";
  query: {
    raw: string;
    normalized_tokens: string[];
    extracted_handles: string[];
  };
  matches: ResolverMatchAudit[];
  selected_match_contact_id: string | null;
  selected_match_confidence: number | null;
  decision: ResolverDecision;
  thresholds: {
    auto_select_min: number;
    ambiguous_min: number;
  };
}

export interface LeadCandidatesPayloadV2 {
  schema_version: "v2";
  lead_candidates: LeadCandidateV2[];
  model_meta: LeadCandidatesModelMeta;
  quality_flags: LeadCandidateQualityFlag[];
}

export interface OwnerContactDirectoryRow {
  id: string;
  owner_user_id: string;
  source: OwnerContactSource;
  platform: OwnerContactPlatform;
  owner_scope_type: OwnerContactScopeType;
  owner_scope_ref: string;
  owner_scope_label: string | null;
  external_ref: string | null;
  display_name: string;
  normalized_name: string;
  aliases: unknown;
  handles: unknown;
  emails: unknown;
  phones: unknown;
  confidence_hint: number | null;
  is_active: boolean;
  source_updated_at: string | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerContactDirectoryItem {
  id: string;
  source: OwnerContactSource;
  platform: OwnerContactPlatform;
  owner_scope_type: OwnerContactScopeType;
  owner_scope_ref: string;
  owner_scope_label: string | null;
  external_ref: string | null;
  display_name: string;
  normalized_name: string;
  aliases: string[];
  handles: Array<{ platform: string | null; value: string; normalized: string }>;
  emails: string[];
  phones: string[];
  confidence_hint: number | null;
  is_active: boolean;
  source_updated_at: string | null;
  updated_at: string;
}
