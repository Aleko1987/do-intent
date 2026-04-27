import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type {
  CandidateSignal,
  CandidateSignalQueueItem,
  CandidateSignalReminder,
} from "~backend/marketing/candidate_signal_types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ManualScreenshotIntake from "@/components/marketing/ManualScreenshotIntake";
import type { MarketingLead } from "~backend/marketing/types";

const CHANNEL_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  facebook: "default",
  instagram: "secondary",
  whatsapp: "outline",
  email: "secondary",
  website: "default",
  manual_upload: "outline",
};

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "manual_upload", label: "Manual upload" },
  { value: "unknown", label: "Unknown" },
] as const;

interface ListCandidateSignalsResponse {
  items: CandidateSignalQueueItem[];
}

interface RequestReminderResponse {
  reminder: CandidateSignalReminder;
  candidate_signal: CandidateSignal;
  whatsapp_message_url: string;
}

interface AttachEvidenceResponse {
  candidate_signal: CandidateSignal;
}

interface ReviewCandidateSignalResponse {
  candidate_signal: CandidateSignal;
}

interface CreateLeadFromCandidateSignalResponse {
  lead: MarketingLead;
  candidate_signal: CandidateSignal;
}

interface MergeCandidateSignalLeadResponse {
  lead: MarketingLead;
  candidate_signal: CandidateSignal;
}

interface PromoteCandidateSignalResponse {
  event: {
    id: string;
    event_type: string;
  };
}

interface ListLeadsResponse {
  leads: MarketingLead[];
}

interface OwnerContactDirectoryItemView {
  id: string;
  source: "csv_upload" | "paste_text" | "api_refresh";
  platform: "instagram" | "facebook" | "whatsapp" | "email" | "website" | "manual_upload" | "unknown";
  display_name: string;
  normalized_name: string;
  is_active: boolean;
  emails: string[];
  handles: Array<{ platform: string | null; value: string; normalized: string }>;
  phones: string[];
}

interface ListOwnerContactDirectoryResponse {
  items: OwnerContactDirectoryItemView[];
}

interface ImportOwnerContactsResponse {
  batch_id: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  errors: Array<{ row: number; reason: string }>;
}

interface ReviewReminderSettings {
  enabled: boolean;
  frequency_unit: "daily" | "weekly";
  frequency_interval: number;
  weekly_day: number;
  reminder_time: string;
  timezone: string;
  mobile_channel: "whatsapp" | "email";
  next_reminder_at: string | null;
  last_notified_at: string | null;
}

interface HotkeyCaptureMetadata {
  source: "hotkey_capture";
  capture_mode?: "region" | "fullscreen";
  capture_scope?: "region" | "fullscreen";
  captured_at?: string;
  workstation_id?: string | null;
  app_version?: string | null;
  target_app_hint?: string | null;
  ocr_text?: string | null;
  ocr_confidence?: number | null;
  ocr_engine?: string | null;
  ocr_captured_at?: string | null;
  ocr_error?: string | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_confidence?: number | null;
  llm_extracted_at?: string | null;
  llm_error?: string | null;
  lead_suggestion_json?: string | null;
  lead_analysis_json?: string | null;
  lead_candidates_v2_json?: string | null;
  resolver_output_v2_json?: string | null;
  operator_source_platform?: string | null;
  suggestion_state?: "none" | "suggested" | "approved" | "rejected";
}

interface LeadSuggestionDraft {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  reason: string;
  suggested_event_type: string;
}

interface LeadAnalysisView {
  entries: string[];
  actions: string[];
  potential_lead: boolean | null;
  rationale: string;
}

interface LeadCandidateResolutionOption {
  contact_id: string;
  display_name: string;
  score: number;
  method: "exact" | "prefix" | "fuzzy";
}

interface LeadCandidateDraft {
  candidate_id: string;
  intent_type: string;
  confidence: number;
  next_action: "review" | "request_evidence" | "defer";
  reasons: string[];
  evidence_snippets: Array<{ source: "ocr" | "llm" | "manual"; text: string }>;
  resolved_contact: {
    contact_id: string;
    display_name: string;
    confidence: number;
    method: "exact" | "prefix" | "fuzzy";
  } | null;
  resolution_candidates: LeadCandidateResolutionOption[];
}

interface LeadCandidatesPayloadV2View {
  schema_version: "v2";
  lead_candidates: LeadCandidateDraft[];
  model_meta: {
    provider: string | null;
    model: string | null;
    prompt_version: string | null;
    schema_version: "v2";
    elapsed_ms: number | null;
    timeout_ms: number | null;
    fallback_used: boolean;
  };
  quality_flags: string[];
}

function formatMaybeNumber(value: unknown): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "n/a";
}

const DEFAULT_REVIEW_REMINDER_SETTINGS: ReviewReminderSettings = {
  enabled: false,
  frequency_unit: "weekly",
  frequency_interval: 1,
  weekly_day: 1,
  reminder_time: "09:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  mobile_channel: "whatsapp",
  next_reminder_at: null,
  last_notified_at: null,
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

function readHotkeyCaptureMetadata(value: unknown): HotkeyCaptureMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  if (obj.source !== "hotkey_capture") {
    return null;
  }
  return {
    source: "hotkey_capture",
    capture_mode: obj.capture_mode === "fullscreen" ? "fullscreen" : obj.capture_mode === "region" ? "region" : undefined,
    capture_scope: obj.capture_scope === "fullscreen" ? "fullscreen" : obj.capture_scope === "region" ? "region" : undefined,
    captured_at: typeof obj.captured_at === "string" ? obj.captured_at : undefined,
    workstation_id: typeof obj.workstation_id === "string" ? obj.workstation_id : null,
    app_version: typeof obj.app_version === "string" ? obj.app_version : null,
    target_app_hint: typeof obj.target_app_hint === "string" ? obj.target_app_hint : null,
    ocr_text: typeof obj.ocr_text === "string" ? obj.ocr_text : null,
    ocr_confidence:
      typeof obj.ocr_confidence === "number"
        ? obj.ocr_confidence
        : Number.isFinite(Number(obj.ocr_confidence))
          ? Number(obj.ocr_confidence)
          : null,
    ocr_engine: typeof obj.ocr_engine === "string" ? obj.ocr_engine : null,
    ocr_captured_at: typeof obj.ocr_captured_at === "string" ? obj.ocr_captured_at : null,
    ocr_error: typeof obj.ocr_error === "string" ? obj.ocr_error : null,
    llm_provider: typeof obj.llm_provider === "string" ? obj.llm_provider : null,
    llm_model: typeof obj.llm_model === "string" ? obj.llm_model : null,
    llm_confidence:
      typeof obj.llm_confidence === "number"
        ? obj.llm_confidence
        : Number.isFinite(Number(obj.llm_confidence))
          ? Number(obj.llm_confidence)
          : null,
    llm_extracted_at: typeof obj.llm_extracted_at === "string" ? obj.llm_extracted_at : null,
    llm_error: typeof obj.llm_error === "string" ? obj.llm_error : null,
    lead_suggestion_json: typeof obj.lead_suggestion_json === "string" ? obj.lead_suggestion_json : null,
    lead_analysis_json: typeof obj.lead_analysis_json === "string" ? obj.lead_analysis_json : null,
    lead_candidates_v2_json: typeof obj.lead_candidates_v2_json === "string" ? obj.lead_candidates_v2_json : null,
    resolver_output_v2_json: typeof obj.resolver_output_v2_json === "string" ? obj.resolver_output_v2_json : null,
    operator_source_platform:
      typeof obj.operator_source_platform === "string" ? obj.operator_source_platform : null,
    suggestion_state:
      obj.suggestion_state === "suggested" ||
      obj.suggestion_state === "approved" ||
      obj.suggestion_state === "rejected"
        ? obj.suggestion_state
        : "none",
  };
}

function parseLeadAnalysis(metadata: HotkeyCaptureMetadata | null): LeadAnalysisView {
  if (!metadata?.lead_analysis_json) {
    return { entries: [], actions: [], potential_lead: null, rationale: "" };
  }
  try {
    const parsed = JSON.parse(metadata.lead_analysis_json) as Record<string, unknown>;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [];
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [];
    return {
      entries,
      actions,
      potential_lead: parsed.potential_lead === true ? true : parsed.potential_lead === false ? false : null,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    };
  } catch {
    return { entries: [], actions: [], potential_lead: null, rationale: "" };
  }
}

function parseLeadSuggestion(metadata: HotkeyCaptureMetadata | null): LeadSuggestionDraft {
  if (!metadata?.lead_suggestion_json) {
    return {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      reason: "",
      suggested_event_type: "",
    };
  }
  try {
    const parsed = JSON.parse(metadata.lead_suggestion_json) as Record<string, unknown>;
    return {
      company_name: typeof parsed.company_name === "string" ? parsed.company_name : "",
      contact_name: typeof parsed.contact_name === "string" ? parsed.contact_name : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      suggested_event_type: typeof parsed.suggested_event_type === "string" ? parsed.suggested_event_type : "",
    };
  } catch {
    return {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      reason: "",
      suggested_event_type: "",
    };
  }
}

function projectLegacySuggestionToCandidate(
  suggestion: LeadSuggestionDraft,
  analysis: LeadAnalysisView
): LeadCandidateDraft {
  return {
    candidate_id: "legacy_projection",
    intent_type: suggestion.suggested_event_type || "other",
    confidence: 0,
    next_action: "review",
    reasons: [suggestion.reason, analysis.rationale].filter((value): value is string => value.length > 0),
    evidence_snippets: [
      ...analysis.entries.slice(0, 2).map((text) => ({ source: "llm" as const, text })),
      ...analysis.actions.slice(0, 2).map((text) => ({ source: "llm" as const, text })),
    ],
    resolved_contact: null,
    resolution_candidates: [],
  };
}

function parseLeadCandidatesV2(metadata: HotkeyCaptureMetadata | null): LeadCandidatesPayloadV2View | null {
  if (!metadata?.lead_candidates_v2_json) {
    return null;
  }
  try {
    const parsed = JSON.parse(metadata.lead_candidates_v2_json) as Record<string, unknown>;
    if (parsed.schema_version !== "v2" || !Array.isArray(parsed.lead_candidates)) {
      return null;
    }
    const leadCandidates = parsed.lead_candidates
      .map((candidate): LeadCandidateDraft | null => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
        const record = candidate as Record<string, unknown>;
        const reasons = Array.isArray(record.reasons)
          ? record.reasons.filter((entry): entry is string => typeof entry === "string").slice(0, 8)
          : [];
        const evidenceSnippets = Array.isArray(record.evidence_snippets)
          ? record.evidence_snippets
              .map((entry) => {
                if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
                const item = entry as Record<string, unknown>;
                if (typeof item.text !== "string") return null;
                return {
                  source: item.source === "ocr" || item.source === "manual" ? item.source : ("llm" as const),
                  text: item.text,
                };
              })
              .filter((entry): entry is { source: "ocr" | "llm" | "manual"; text: string } => Boolean(entry))
              .slice(0, 6)
          : [];

        const resolvedContact =
          record.resolved_contact && typeof record.resolved_contact === "object" && !Array.isArray(record.resolved_contact)
            ? (() => {
                const contact = record.resolved_contact as Record<string, unknown>;
                if (
                  typeof contact.contact_id !== "string" ||
                  typeof contact.display_name !== "string" ||
                  !Number.isFinite(Number(contact.confidence))
                ) {
                  return null;
                }
                return {
                  contact_id: contact.contact_id,
                  display_name: contact.display_name,
                  confidence: Number(contact.confidence),
                  method:
                    contact.method === "exact" || contact.method === "prefix" || contact.method === "fuzzy"
                      ? contact.method
                      : ("fuzzy" as const),
                };
              })()
            : null;

        const resolutionCandidates = Array.isArray(record.resolution_candidates)
          ? record.resolution_candidates
              .map((option) => {
                if (!option || typeof option !== "object" || Array.isArray(option)) return null;
                const candidateOption = option as Record<string, unknown>;
                if (
                  typeof candidateOption.contact_id !== "string" ||
                  typeof candidateOption.display_name !== "string" ||
                  !Number.isFinite(Number(candidateOption.score))
                ) {
                  return null;
                }
                return {
                  contact_id: candidateOption.contact_id,
                  display_name: candidateOption.display_name,
                  score: Number(candidateOption.score),
                  method:
                    candidateOption.method === "exact" ||
                    candidateOption.method === "prefix" ||
                    candidateOption.method === "fuzzy"
                      ? candidateOption.method
                      : ("fuzzy" as const),
                };
              })
              .filter((entry): entry is LeadCandidateResolutionOption => Boolean(entry))
              .slice(0, 5)
          : [];

        return {
          candidate_id: typeof record.candidate_id === "string" ? record.candidate_id : crypto.randomUUID(),
          intent_type: typeof record.intent_type === "string" ? record.intent_type : "other",
          confidence: Number.isFinite(Number(record.confidence)) ? Number(record.confidence) : 0,
          next_action:
            record.next_action === "request_evidence" || record.next_action === "defer" ? record.next_action : "review",
          reasons,
          evidence_snippets: evidenceSnippets,
          resolved_contact: resolvedContact,
          resolution_candidates: resolutionCandidates,
        };
      })
      .filter((candidate): candidate is LeadCandidateDraft => Boolean(candidate))
      .slice(0, 5);

    const modelMetaRaw =
      parsed.model_meta && typeof parsed.model_meta === "object" && !Array.isArray(parsed.model_meta)
        ? (parsed.model_meta as Record<string, unknown>)
        : {};

    return {
      schema_version: "v2",
      lead_candidates: leadCandidates,
      model_meta: {
        provider: typeof modelMetaRaw.provider === "string" ? modelMetaRaw.provider : null,
        model: typeof modelMetaRaw.model === "string" ? modelMetaRaw.model : null,
        prompt_version: typeof modelMetaRaw.prompt_version === "string" ? modelMetaRaw.prompt_version : null,
        schema_version: "v2",
        elapsed_ms: Number.isFinite(Number(modelMetaRaw.elapsed_ms)) ? Number(modelMetaRaw.elapsed_ms) : null,
        timeout_ms: Number.isFinite(Number(modelMetaRaw.timeout_ms)) ? Number(modelMetaRaw.timeout_ms) : null,
        fallback_used: modelMetaRaw.fallback_used === true,
      },
      quality_flags: Array.isArray(parsed.quality_flags)
        ? parsed.quality_flags.filter((entry): entry is string => typeof entry === "string").slice(0, 8)
        : [],
    };
  } catch {
    return null;
  }
}

export default function CandidateSignalReviewQueue() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<CandidateSignalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeReminder, setActiveReminder] = useState<CandidateSignalReminder | null>(null);
  const [templateText, setTemplateText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string | null>(null);
  const [selectedFileData, setSelectedFileData] = useState<string | null>(null);
  const [suggestionRowId, setSuggestionRowId] = useState<string | null>(null);
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null);
  const [leadCandidatesDraft, setLeadCandidatesDraft] = useState<LeadCandidatesPayloadV2View | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [mergeLeadId, setMergeLeadId] = useState("");
  const [leadOptions, setLeadOptions] = useState<MarketingLead[]>([]);
  const [leadLoading, setLeadLoading] = useState(false);
  const [ownerContacts, setOwnerContacts] = useState<OwnerContactDirectoryItemView[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactImportMode, setContactImportMode] = useState<"full_refresh" | "delta">("full_refresh");
  const [contactImportFormat, setContactImportFormat] = useState<"csv" | "text">("csv");
  const [contactImportSource, setContactImportSource] = useState<"csv_upload" | "paste_text" | "api_refresh">(
    "csv_upload"
  );
  const [contactImportPlatform, setContactImportPlatform] = useState<
    "instagram" | "facebook" | "whatsapp" | "email" | "website" | "manual_upload" | "unknown"
  >("instagram");
  const [contactImportPayload, setContactImportPayload] = useState("");
  const [contactImportBusy, setContactImportBusy] = useState(false);
  const [rowChannelDrafts, setRowChannelDrafts] = useState<Record<string, CandidateSignalQueueItem["channel"]>>({});
  const [reminderSettings, setReminderSettings] = useState<ReviewReminderSettings>(
    DEFAULT_REVIEW_REMINDER_SETTINGS
  );
  const [reminderDraft, setReminderDraft] = useState<ReviewReminderSettings>(
    DEFAULT_REVIEW_REMINDER_SETTINGS
  );
  const [reminderLoading, setReminderLoading] = useState(true);
  const [reminderSaving, setReminderSaving] = useState(false);

  useEffect(() => {
    void loadQueue();
    void loadReviewReminderSettings();
    void loadLeads();
    void loadOwnerContacts();
  }, []);

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<ListCandidateSignalsResponse>("/marketing/candidate-signals?limit=100", {
        method: "GET",
      });
      setRows(response.items);
      setRowChannelDrafts(
        Object.fromEntries(
          response.items.map((item) => [item.id, item.channel]) as Array<
            [string, CandidateSignalQueueItem["channel"]]
          >
        )
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load candidate signal queue");
    } finally {
      setLoading(false);
    }
  }

  async function loadReviewReminderSettings() {
    setReminderLoading(true);
    try {
      const settings = await apiFetch<ReviewReminderSettings>("/marketing/review-reminder-settings", {
        method: "GET",
      });
      setReminderSettings(settings);
      setReminderDraft(settings);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load review reminder settings");
    } finally {
      setReminderLoading(false);
    }
  }

  async function loadLeads() {
    setLeadLoading(true);
    try {
      const response = await apiFetch<ListLeadsResponse>("/marketing/leads?limit=100", {
        method: "GET",
      });
      setLeadOptions(response.leads);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLeadLoading(false);
    }
  }

  async function loadOwnerContacts() {
    setContactsLoading(true);
    try {
      const response = await apiFetch<ListOwnerContactDirectoryResponse>("/marketing/owner-contacts?limit=30", {
        method: "GET",
      });
      setOwnerContacts(response.items);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load owner contacts");
    } finally {
      setContactsLoading(false);
    }
  }

  async function handleImportOwnerContacts() {
    if (!contactImportPayload.trim()) {
      setError("Paste CSV/text contacts payload before importing.");
      return;
    }
    setContactImportBusy(true);
    setError(null);
    try {
      const source =
        contactImportFormat === "csv"
          ? contactImportSource === "paste_text"
            ? "csv_upload"
            : contactImportSource
          : "paste_text";
      const response = await apiFetch<ImportOwnerContactsResponse>("/marketing/owner-contacts/import", {
        method: "POST",
        body: JSON.stringify({
          source,
          platform: contactImportPlatform,
          mode: contactImportMode,
          format: contactImportFormat,
          payload: contactImportPayload,
        }),
      });
      const errorsPreview =
        response.errors.length > 0
          ? ` First errors: ${response.errors
              .slice(0, 2)
              .map((errorItem) => `row ${errorItem.row}: ${errorItem.reason}`)
              .join("; ")}`
          : "";
      setError(
        `Contacts imported for ${contactImportPlatform} (${response.accepted_rows}/${response.total_rows}). Rejected: ${response.rejected_rows}.${errorsPreview}`
      );
      await loadOwnerContacts();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to import owner contacts");
    } finally {
      setContactImportBusy(false);
    }
  }

  async function saveReviewReminderSettings() {
    setReminderSaving(true);
    setError(null);
    try {
      const payload: Partial<ReviewReminderSettings> = {
        enabled: reminderDraft.enabled,
        frequency_unit: reminderDraft.frequency_unit,
        frequency_interval: Math.max(1, Math.floor(reminderDraft.frequency_interval)),
        weekly_day: Math.max(0, Math.min(6, Math.floor(reminderDraft.weekly_day))),
        reminder_time: reminderDraft.reminder_time,
        timezone: reminderDraft.timezone.trim() || "UTC",
        mobile_channel: reminderDraft.mobile_channel,
      };
      const updated = await apiFetch<ReviewReminderSettings>("/marketing/review-reminder-settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setReminderSettings(updated);
      setReminderDraft(updated);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save review reminder settings");
    } finally {
      setReminderSaving(false);
    }
  }

  const activeRow = useMemo(() => rows.find((row) => row.id === activeId) ?? null, [rows, activeId]);
  const suggestionRow = useMemo(
    () => rows.find((row) => row.id === suggestionRowId) ?? null,
    [rows, suggestionRowId]
  );
  const selectedCandidateDraft = useMemo(() => {
    if (!leadCandidatesDraft) return null;
    return leadCandidatesDraft.lead_candidates[selectedCandidateIndex] ?? null;
  }, [leadCandidatesDraft, selectedCandidateIndex]);

  async function handleRequestEvidence(row: CandidateSignalQueueItem) {
    setBusyId(row.id);
    try {
      const response = await apiFetch<RequestReminderResponse>(`/marketing/candidate-signals/${row.id}/reminders`, {
        method: "POST",
        body: JSON.stringify({ channel: "whatsapp" }),
      });
      setActiveId(row.id);
      setActiveReminder(response.reminder);
      setTemplateText(response.reminder.template_text);
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...response.candidate_signal } : item)));
      window.open(response.whatsapp_message_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to request evidence reminder");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAttachEvidence(row: CandidateSignalQueueItem) {
    const evidenceRef = selectedFileData ?? evidenceUrl.trim();
    if (!evidenceRef) {
      setError("Attach a screenshot file or provide an evidence URL/path.");
      return;
    }

    setBusyId(row.id);
    try {
      const metadata = selectedFileName
        ? JSON.stringify({
            source_note: "Operator uploaded WhatsApp reply screenshot manually",
            original_file_name: selectedFileName,
          })
        : JSON.stringify({ source_note: "Operator linked WhatsApp reply evidence reference" });

      const response = await apiFetch<AttachEvidenceResponse>(`/marketing/candidate-signals/${row.id}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          reminder_id: activeReminder?.id,
          evidence_type: "screenshot",
          storage_kind: selectedFileData ? "inline" : "external_url",
          evidence_ref: evidenceRef,
          mime_type: selectedMimeType ?? undefined,
          metadata,
        }),
      });

      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...response.candidate_signal } : item)));
      setEvidenceUrl("");
      setSelectedFileData(null);
      setSelectedFileName(null);
      setSelectedMimeType(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to attach evidence");
    } finally {
      setBusyId(null);
    }
  }

  function openSuggestion(row: CandidateSignalQueueItem) {
    const metadata = readHotkeyCaptureMetadata(row.metadata);
    const leadAnalysis = parseLeadAnalysis(metadata);
    const suggestion = parseLeadSuggestion(metadata);
    const fromV2 = parseLeadCandidatesV2(metadata);
    const fallbackPayload: LeadCandidatesPayloadV2View = {
      schema_version: "v2",
      lead_candidates: [projectLegacySuggestionToCandidate(suggestion, leadAnalysis)],
      model_meta: {
        provider: metadata?.llm_provider ?? null,
        model: metadata?.llm_model ?? null,
        prompt_version: "legacy_projection",
        schema_version: "v2",
        elapsed_ms: null,
        timeout_ms: null,
        fallback_used: true,
      },
      quality_flags: ["legacy_projection"],
    };
    setSuggestionRowId(row.id);
    setLeadCandidatesDraft(fromV2 ?? fallbackPayload);
    setSelectedCandidateIndex(0);
    setMergeLeadId("");
  }

  async function handleRejectSuggestion(row: CandidateSignalQueueItem) {
    setSuggestionBusyId(row.id);
    setError(null);
    try {
      const response = await apiFetch<ReviewCandidateSignalResponse>(`/marketing/candidate-signals/${row.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          decision: "reject",
          decision_reason: "Operator rejected lead suggestion",
          set_status: "rejected",
          metadata_patch: JSON.stringify({
            suggestion_state: "rejected",
            suggestion_rejected_at: new Date().toISOString(),
            suggestion_rejected_by: "operator",
          }),
        }),
      });
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...response.candidate_signal } : item)));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to reject suggestion");
    } finally {
      setSuggestionBusyId(null);
    }
  }

  async function handleApproveSuggestion(row: CandidateSignalQueueItem) {
    if (!selectedCandidateDraft || !leadCandidatesDraft) {
      setError("Open a suggestion first.");
      return;
    }

    setSuggestionBusyId(row.id);
    setError(null);
    try {
      let linkedLeadId = row.lead_id;
      if (mergeLeadId) {
        const mergeResponse = await apiFetch<MergeCandidateSignalLeadResponse>(
          `/marketing/candidate-signals/${row.id}/merge-lead`,
          {
            method: "POST",
            body: JSON.stringify({
              lead_id: mergeLeadId,
              reason: "Approved LLM suggestion and merged with existing lead",
            }),
          }
        );
        linkedLeadId = mergeResponse.lead.id;
      } else {
        const createLeadResponse = await apiFetch<CreateLeadFromCandidateSignalResponse>(
          `/marketing/candidate-signals/${row.id}/create-lead`,
          {
            method: "POST",
            body: JSON.stringify({
              company_name: undefined,
              contact_name: selectedCandidateDraft.resolved_contact?.display_name || undefined,
              email: undefined,
              phone: undefined,
              source_type: "manual",
              reason: "Approved LLM suggestion from review queue",
            }),
          }
        );
        linkedLeadId = createLeadResponse.lead.id;
      }

      const reviewResponse = await apiFetch<ReviewCandidateSignalResponse>(
        `/marketing/candidate-signals/${row.id}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: "approve",
            decision_reason: "Operator approved lead suggestion",
            set_status: "approved",
            set_lead_id: linkedLeadId ?? undefined,
            set_event_type: selectedCandidateDraft.intent_type || undefined,
            metadata_patch: JSON.stringify({
              suggestion_state: "approved",
              approved_at: new Date().toISOString(),
              approved_by: "operator",
              lead_suggestion_json: JSON.stringify({
                company_name: null,
                contact_name: selectedCandidateDraft.resolved_contact?.display_name ?? null,
                email: null,
                phone: null,
                reason: selectedCandidateDraft.reasons.join(" | ") || null,
                suggested_event_type: selectedCandidateDraft.intent_type || null,
              }),
              lead_candidates_v2_json: JSON.stringify(leadCandidatesDraft),
            }),
          }),
        }
      );

      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...reviewResponse.candidate_signal } : item)));
      setSuggestionRowId(null);
      setLeadCandidatesDraft(null);
      setMergeLeadId("");
      setSelectedCandidateIndex(0);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to approve suggestion");
    } finally {
      setSuggestionBusyId(null);
    }
  }

  async function handleAddIntent(row: CandidateSignalQueueItem) {
    if (!row.lead_id) {
      setError("Approve or merge to a lead before adding intent to the marketing pipeline.");
      return;
    }

    setBusyId(row.id);
    setError(null);
    try {
      const metadata = readHotkeyCaptureMetadata(row.metadata);
      const leadCandidates = parseLeadCandidatesV2(metadata);
      const selectedIntent =
        leadCandidates?.lead_candidates[0]?.intent_type ||
        parseLeadSuggestion(metadata).suggested_event_type ||
        row.suggested_event_type ||
        undefined;

      if (row.status !== "approved") {
        setError("Candidate signal must be approved before adding intent to the pipeline.");
        return;
      }
      const response = await apiFetch<PromoteCandidateSignalResponse>(
        `/marketing/candidate-signals/${row.id}/promote`,
        {
          method: "POST",
          body: JSON.stringify({
            lead_id: row.lead_id,
            event_type: selectedIntent,
            reason: "Reviewer added intent to marketing pipeline",
          }),
        }
      );
      console.info("[review-queue] promoted candidate signal", {
        candidateSignalId: row.id,
        eventId: response.event.id,
        eventType: response.event.event_type,
      });
      await loadQueue();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to add intent to pipeline");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApplySignalChannel(row: CandidateSignalQueueItem) {
    const selectedChannel = rowChannelDrafts[row.id] ?? row.channel;
    if (selectedChannel === row.channel) {
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      const response = await apiFetch<ReviewCandidateSignalResponse>(
        `/marketing/candidate-signals/${row.id}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: "edit",
            decision_reason: "Operator updated source platform/channel",
            set_status: row.status,
            set_channel: selectedChannel,
            metadata_patch: JSON.stringify({
              operator_source_platform: selectedChannel,
              operator_source_platform_set_at: new Date().toISOString(),
            }),
          }),
        }
      );
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, ...response.candidate_signal } : item))
      );
      setRowChannelDrafts((prev) => ({ ...prev, [row.id]: selectedChannel }));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update signal source platform");
    } finally {
      setBusyId(null);
    }
  }

  function onFileChange(file: File | null) {
    if (!file) {
      setSelectedFileData(null);
      setSelectedFileName(null);
      setSelectedMimeType(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setSelectedFileData(result);
        setSelectedFileName(file.name);
        setSelectedMimeType(file.type || null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function copyTemplate() {
    if (!templateText) return;
    await navigator.clipboard.writeText(templateText);
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading review queue…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Candidate Signal Review Queue</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Human review is mandatory before promotion to canonical intent events.
        </p>
      </div>

      <ManualScreenshotIntake onSuccess={() => void loadQueue()} />

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Owner contacts / friends directory</h3>
            <p className="text-sm text-muted-foreground">
              Upload CSV or pasted text to improve resolver precision during review.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadOwnerContacts()} disabled={contactsLoading}>
            {contactsLoading ? "Refreshing..." : "Refresh contacts"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={contactImportFormat}
            onChange={(e) => setContactImportFormat(e.target.value as "csv" | "text")}
          >
            <option value="csv">CSV payload</option>
            <option value="text">Paste text lines</option>
          </select>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={contactImportMode}
            onChange={(e) => setContactImportMode(e.target.value as "full_refresh" | "delta")}
          >
            <option value="full_refresh">Full refresh</option>
            <option value="delta">Delta upsert</option>
          </select>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={contactImportSource}
            onChange={(e) =>
              setContactImportSource(e.target.value as "csv_upload" | "paste_text" | "api_refresh")
            }
          >
            <option value="csv_upload">Source: CSV upload</option>
            <option value="paste_text">Source: Paste text</option>
            <option value="api_refresh">Source: API refresh</option>
          </select>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={contactImportPlatform}
            onChange={(e) =>
              setContactImportPlatform(
                e.target.value as
                  | "instagram"
                  | "facebook"
                  | "whatsapp"
                  | "email"
                  | "website"
                  | "manual_upload"
                  | "unknown"
              )
            }
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Platform: {option.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => void handleImportOwnerContacts()} disabled={contactImportBusy}>
            {contactImportBusy ? "Importing..." : "Import contacts"}
          </Button>
        </div>
        <Textarea
          className="min-h-[110px]"
          placeholder={
            contactImportFormat === "csv"
              ? "CSV header example: display_name,external_ref,aliases,handles,emails,phones"
              : "Paste one contact per line. Example: Jane Doe @janedoe jane@acme.com +1 555..."
          }
          value={contactImportPayload}
          onChange={(e) => setContactImportPayload(e.target.value)}
        />
        <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground space-y-1">
          <p>Resolver contact samples:</p>
          {ownerContacts.length === 0 ? (
            <p>No contacts imported yet.</p>
          ) : (
            ownerContacts.slice(0, 5).map((contact) => (
              <p key={contact.id}>
                {contact.display_name}
                {contact.platform ? ` · ${contact.platform}` : ""}
                {contact.emails[0] ? ` · ${contact.emails[0]}` : ""}
                {contact.handles[0]?.value ? ` · ${contact.handles[0].value}` : ""}
              </p>
            ))
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold">Review reminder settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure a recurring mobile reminder to review pending intent signals.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReminderDraft(reminderSettings)}
              disabled={reminderSaving || reminderLoading}
            >
              Reset
            </Button>
            <Button size="sm" onClick={() => void saveReviewReminderSettings()} disabled={reminderSaving || reminderLoading}>
              {reminderSaving ? "Saving..." : "Save reminder"}
            </Button>
          </div>
        </div>
        {reminderLoading ? (
          <p className="text-sm text-muted-foreground">Loading reminder settings...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Reminder enabled</p>
              <Button
                size="sm"
                variant={reminderDraft.enabled ? "secondary" : "outline"}
                onClick={() =>
                  setReminderDraft((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }))
                }
              >
                {reminderDraft.enabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Frequency unit</p>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={reminderDraft.frequency_unit}
                onChange={(e) =>
                  setReminderDraft((prev) => ({
                    ...prev,
                    frequency_unit: e.target.value as "daily" | "weekly",
                  }))
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Every (interval)</p>
              <Input
                type="number"
                min={1}
                max={30}
                value={reminderDraft.frequency_interval}
                onChange={(e) =>
                  setReminderDraft((prev) => ({
                    ...prev,
                    frequency_interval: Number(e.target.value || 1),
                  }))
                }
              />
            </div>
            {reminderDraft.frequency_unit === "weekly" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Weekly day</p>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={reminderDraft.weekly_day}
                  onChange={(e) =>
                    setReminderDraft((prev) => ({
                      ...prev,
                      weekly_day: Number(e.target.value),
                    }))
                  }
                >
                  {WEEKDAY_OPTIONS.map((weekday) => (
                    <option key={weekday.value} value={weekday.value}>
                      {weekday.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Reminder time (24h)</p>
              <Input
                type="time"
                value={reminderDraft.reminder_time}
                onChange={(e) =>
                  setReminderDraft((prev) => ({
                    ...prev,
                    reminder_time: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Timezone</p>
              <Input
                value={reminderDraft.timezone}
                onChange={(e) =>
                  setReminderDraft((prev) => ({
                    ...prev,
                    timezone: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Mobile channel</p>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={reminderDraft.mobile_channel}
                onChange={(e) =>
                  setReminderDraft((prev) => ({
                    ...prev,
                    mobile_channel: e.target.value as "whatsapp" | "email",
                  }))
                }
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
        )}
        {!reminderLoading && (
          <p className="text-xs text-muted-foreground">
            Next reminder:{" "}
            {reminderSettings.next_reminder_at
              ? new Date(reminderSettings.next_reminder_at).toLocaleString()
              : "not scheduled"}
            {" · "}Last sent:{" "}
            {reminderSettings.last_notified_at
              ? new Date(reminderSettings.last_notified_at).toLocaleString()
              : "never"}
          </p>
        )}
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4 space-y-3">
            {(() => {
              const captureMeta = readHotkeyCaptureMetadata(row.metadata);
              const captureScope = captureMeta?.capture_scope ?? captureMeta?.capture_mode;
              const suggestionState = captureMeta?.suggestion_state ?? "none";
              const leadCandidatesPayload = parseLeadCandidatesV2(captureMeta);
              const hasSuggestion =
                (leadCandidatesPayload?.lead_candidates.length ?? 0) > 0 || Boolean(captureMeta?.lead_suggestion_json);
              const leadAnalysis = parseLeadAnalysis(captureMeta);
              return (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{row.actor_display ?? row.actor_handle ?? "Unknown actor"}</span>
                  <Badge variant={CHANNEL_BADGE_VARIANTS[row.channel] ?? "outline"}>{row.channel}</Badge>
                  <Badge variant="outline">{row.status}</Badge>
                  {captureMeta && (
                    <Badge variant="secondary">
                      Hotkey {captureScope === "fullscreen" ? "fullscreen" : "region"}
                    </Badge>
                  )}
                  <Badge variant={suggestionState === "approved" ? "default" : suggestionState === "rejected" ? "outline" : "secondary"}>
                    Suggestion {suggestionState}
                  </Badge>
                  {leadAnalysis.potential_lead === true && <Badge variant="default">Potential lead</Badge>}
                  {leadAnalysis.potential_lead === false && <Badge variant="outline">Not a lead</Badge>}
                  {leadCandidatesPayload && (
                    <Badge variant="secondary">Candidates {leadCandidatesPayload.lead_candidates.length}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{row.summary ?? row.raw_text ?? "No summary provided"}</p>
                <div className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <span>Matched lead: {row.lead_id ?? "Unknown"}</span>
                  <span>Suggested event: {row.suggested_event_type ?? "other"}</span>
                  <span>Suggested score: {formatMaybeNumber(row.suggested_intent_score)}</span>
                  <span>Confidence: {formatMaybeNumber(row.suggestion_confidence)}</span>
                  <span>Evidence count: {row.evidence_count}</span>
                  <span>Reminder status: {row.latest_reminder_status ?? "none"}</span>
                  <span>
                    Source platform: {captureMeta?.operator_source_platform ?? row.channel}
                  </span>
                  {captureMeta?.captured_at && (
                    <span>Captured at: {new Date(captureMeta.captured_at).toLocaleString()}</span>
                  )}
                  {captureMeta?.workstation_id && (
                    <span>Workstation: {captureMeta.workstation_id}</span>
                  )}
                  {captureMeta?.app_version && <span>Companion: {captureMeta.app_version}</span>}
                  {captureMeta?.target_app_hint && <span>Target app: {captureMeta.target_app_hint}</span>}
                  {captureMeta?.ocr_engine && (
                    <span>
                      OCR: {captureMeta.ocr_engine} ({formatMaybeNumber(captureMeta.ocr_confidence)})
                    </span>
                  )}
                  {captureMeta?.llm_model && (
                    <span>
                      LLM: {captureMeta.llm_provider ?? "local"} / {captureMeta.llm_model} (
                      {formatMaybeNumber(captureMeta.llm_confidence)})
                    </span>
                  )}
                  {leadCandidatesPayload?.model_meta.prompt_version && (
                    <span>Prompt: {leadCandidatesPayload.model_meta.prompt_version}</span>
                  )}
                </div>
                {leadCandidatesPayload && (
                  <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground/90">Candidate rows</p>
                    {leadCandidatesPayload.lead_candidates.map((candidate, candidateIndex) => (
                      <div key={candidate.candidate_id} className="rounded border border-border/70 p-2 space-y-1">
                        <p>
                          #{candidateIndex + 1} Intent: <strong>{candidate.intent_type}</strong> · Confidence:{" "}
                          {candidate.confidence.toFixed(2)} · Next: {candidate.next_action}
                        </p>
                        {candidate.resolved_contact ? (
                          <p>
                            Resolved contact: {candidate.resolved_contact.display_name} (
                            {candidate.resolved_contact.method} {candidate.resolved_contact.confidence.toFixed(2)})
                          </p>
                        ) : (
                          <p>Resolved contact: unresolved</p>
                        )}
                        {candidate.resolution_candidates.length > 0 && (
                          <p>
                            Alternatives:{" "}
                            {candidate.resolution_candidates
                              .map((option) => `${option.display_name} ${option.score.toFixed(2)} (${option.method})`)
                              .join(" | ")}
                          </p>
                        )}
                      </div>
                    ))}
                    {leadCandidatesPayload.quality_flags.length > 0 && (
                      <p>Quality flags: {leadCandidatesPayload.quality_flags.join(", ")}</p>
                    )}
                  </div>
                )}
                {(captureMeta?.ocr_text || captureMeta?.ocr_error || captureMeta?.llm_error) && (
                  <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground space-y-1">
                    {captureMeta?.ocr_text && (
                      <p>
                        OCR preview: {captureMeta.ocr_text.slice(0, 240)}
                        {captureMeta.ocr_text.length > 240 ? "..." : ""}
                      </p>
                    )}
                    {captureMeta?.ocr_error && <p>OCR error: {captureMeta.ocr_error}</p>}
                    {captureMeta?.llm_error && <p>LLM error: {captureMeta.llm_error}</p>}
                  </div>
                )}
                {(leadAnalysis.entries.length > 0 || leadAnalysis.actions.length > 0 || leadAnalysis.rationale) && (
                  <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground space-y-2">
                    {leadAnalysis.entries.length > 0 && (
                      <p>
                        Entries: {leadAnalysis.entries.join(" | ")}
                      </p>
                    )}
                    {leadAnalysis.actions.length > 0 && (
                      <p>
                        Actions: {leadAnalysis.actions.join(" | ")}
                      </p>
                    )}
                    {leadAnalysis.rationale && <p>Rationale: {leadAnalysis.rationale}</p>}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 md:w-[360px] md:justify-end">
                <div className="flex gap-2 w-full md:justify-end">
                  <select
                    className="flex h-9 min-w-[170px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    value={rowChannelDrafts[row.id] ?? row.channel}
                    onChange={(e) =>
                      setRowChannelDrafts((prev) => ({
                        ...prev,
                        [row.id]: e.target.value as CandidateSignalQueueItem["channel"],
                      }))
                    }
                    disabled={busyId === row.id}
                  >
                    <option value="instagram">instagram</option>
                    <option value="facebook">facebook</option>
                    <option value="whatsapp">whatsapp</option>
                    <option value="email">email</option>
                    <option value="website">website</option>
                    <option value="manual_upload">manual_upload</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleApplySignalChannel(row)}
                    disabled={busyId === row.id || (rowChannelDrafts[row.id] ?? row.channel) === row.channel}
                  >
                    Apply source
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveId(row.id)}>
                  Open Evidence Flow
                </Button>
                <Button size="sm" onClick={() => void handleRequestEvidence(row)} disabled={busyId === row.id}>
                  Request Evidence
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openSuggestion(row)}
                  disabled={!hasSuggestion && suggestionState === "none"}
                >
                  Review Suggestion
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleAddIntent(row)}
                  disabled={busyId === row.id || !row.lead_id || row.status !== "approved"}
                >
                  Add Intent to Pipeline
                </Button>
              </div>
            </div>
              );
            })()}

            {suggestionRowId === row.id && leadCandidatesDraft && selectedCandidateDraft && (
              <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">Lead candidates review</p>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Select candidate</p>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    value={selectedCandidateIndex}
                    onChange={(e) => setSelectedCandidateIndex(Number(e.target.value))}
                  >
                    {leadCandidatesDraft.lead_candidates.map((candidate, index) => (
                      <option key={candidate.candidate_id} value={index}>
                        Candidate {index + 1} · {candidate.intent_type} · {candidate.confidence.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    placeholder="Intent type"
                    value={selectedCandidateDraft.intent_type}
                    onChange={(e) =>
                      setLeadCandidatesDraft((prev) => {
                        if (!prev) return prev;
                        const next = [...prev.lead_candidates];
                        next[selectedCandidateIndex] = { ...next[selectedCandidateIndex], intent_type: e.target.value };
                        return { ...prev, lead_candidates: next };
                      })
                    }
                  />
                  <Input
                    placeholder="Confidence (0..1)"
                    value={selectedCandidateDraft.confidence}
                    onChange={(e) =>
                      setLeadCandidatesDraft((prev) => {
                        if (!prev) return prev;
                        const parsed = Number(e.target.value);
                        const next = [...prev.lead_candidates];
                        next[selectedCandidateIndex] = {
                          ...next[selectedCandidateIndex],
                          confidence: Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0,
                        };
                        return { ...prev, lead_candidates: next };
                      })
                    }
                  />
                  <Input
                    placeholder="Resolved contact"
                    value={selectedCandidateDraft.resolved_contact?.display_name ?? ""}
                    onChange={(e) =>
                      setLeadCandidatesDraft((prev) => {
                        if (!prev) return prev;
                        const next = [...prev.lead_candidates];
                        next[selectedCandidateIndex] = {
                          ...next[selectedCandidateIndex],
                          resolved_contact: e.target.value.trim()
                            ? {
                                contact_id: next[selectedCandidateIndex].resolved_contact?.contact_id ?? "",
                                display_name: e.target.value,
                                confidence: next[selectedCandidateIndex].resolved_contact?.confidence ?? 0,
                                method: next[selectedCandidateIndex].resolved_contact?.method ?? "fuzzy",
                              }
                            : null,
                        };
                        return { ...prev, lead_candidates: next };
                      })
                    }
                  />
                  <Input
                    placeholder="Next action"
                    value={selectedCandidateDraft.next_action}
                    onChange={(e) =>
                      setLeadCandidatesDraft((prev) => {
                        if (!prev) return prev;
                        const nextAction =
                          e.target.value === "request_evidence" || e.target.value === "defer"
                            ? e.target.value
                            : "review";
                        const next = [...prev.lead_candidates];
                        next[selectedCandidateIndex] = { ...next[selectedCandidateIndex], next_action: nextAction };
                        return { ...prev, lead_candidates: next };
                      })
                    }
                  />
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    value={mergeLeadId}
                    onChange={(e) => setMergeLeadId(e.target.value)}
                    disabled={leadLoading}
                  >
                    <option value="">Create new lead</option>
                    {leadOptions.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.display_name ?? lead.contact_name ?? lead.company_name ?? lead.id}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  className="min-h-[72px]"
                  placeholder="Reasons (one line, separated by |)"
                  value={selectedCandidateDraft.reasons.join(" | ")}
                  onChange={(e) =>
                    setLeadCandidatesDraft((prev) => {
                      if (!prev) return prev;
                      const next = [...prev.lead_candidates];
                      next[selectedCandidateIndex] = {
                        ...next[selectedCandidateIndex],
                        reasons: e.target.value
                          .split("|")
                          .map((reason) => reason.trim())
                          .filter((reason) => reason.length > 0)
                          .slice(0, 8),
                      };
                      return { ...prev, lead_candidates: next };
                    })
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleApproveSuggestion(row)}
                    disabled={suggestionBusyId === row.id}
                  >
                    {suggestionBusyId === row.id ? "Applying..." : "Approve as lead"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRejectSuggestion(row)}
                    disabled={suggestionBusyId === row.id}
                  >
                    Reject suggestion
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSuggestionRowId(null);
                      setLeadCandidatesDraft(null);
                      setMergeLeadId("");
                      setSelectedCandidateIndex(0);
                    }}
                    disabled={suggestionBusyId === row.id}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {activeId === row.id && (
              <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Phase 1: WhatsApp Reminder</p>
                  <textarea
                    className="w-full min-h-[80px] border rounded-md px-3 py-2 text-sm bg-background"
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    placeholder="Generate a reminder first, then copy/edit text before sending in WhatsApp"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void copyTemplate()} disabled={!templateText}>
                      Copy Template
                    </Button>
                    {activeReminder && (
                      <span className="text-xs text-muted-foreground self-center">
                        Reminder: {activeReminder.delivery_status} at {new Date(activeReminder.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Phase 2: Attach Reply Screenshot Evidence</p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                  />
                  {selectedFileName && (
                    <p className="text-xs text-muted-foreground">Prepared file: {selectedFileName}</p>
                  )}
                  <Input
                    placeholder="Or paste a secure evidence URL/path"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleAttachEvidence(row)}
                    disabled={busyId === row.id || (!selectedFileData && !evidenceUrl.trim())}
                  >
                    Attach Evidence
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {!rows.length && <p className="text-sm text-muted-foreground">No candidate signals found.</p>}
      {activeRow && (
        <Button size="sm" variant="secondary" onClick={() => void loadQueue()}>
          Refresh Queue
        </Button>
      )}
    </div>
  );
}
