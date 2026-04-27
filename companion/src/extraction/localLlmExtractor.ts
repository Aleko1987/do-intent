import { randomUUID } from "node:crypto";

const MAX_SUGGESTION_JSON_BYTES = 8 * 1024;
const MAX_FREEFORM_CHARS = 500;

export interface LeadSuggestion {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  reason?: string;
  suggested_event_type?: string;
}

export interface LeadAnalysis {
  entries: string[];
  actions: string[];
  potential_lead: boolean | null;
  rationale?: string;
}

export interface LeadCandidateV2 {
  candidate_id: string;
  intent_type: string;
  confidence: number;
  evidence_snippets: Array<{ source: "ocr" | "llm" | "manual"; text: string }>;
  next_action: "review" | "request_evidence" | "defer";
  reasons: string[];
  resolved_contact: null;
  resolution_candidates: Array<{
    contact_id: string;
    display_name: string;
    score: number;
    method: "exact" | "prefix" | "fuzzy";
  }>;
}

export interface LeadCandidatesPayloadV2 {
  schema_version: "v2";
  lead_candidates: LeadCandidateV2[];
  model_meta: {
    provider: "ollama";
    model: string;
    prompt_version: string;
    schema_version: "v2";
    elapsed_ms: number | null;
    timeout_ms: number;
    fallback_used: boolean;
  };
  quality_flags: Array<"llm_timeout" | "low_confidence" | "ocr_sparse" | "resolver_ambiguous" | "legacy_projection">;
}

export interface LlmExtractionSuccess {
  ok: true;
  suggestion: LeadSuggestion;
  analysis: LeadAnalysis;
  confidence: number | null;
  provider: "ollama";
  model: string;
  extractedAt: string;
  elapsedMs: number;
  leadCandidates: LeadCandidatesPayloadV2;
}

export interface LlmExtractionFailure {
  ok: false;
  error: string;
  provider: "ollama";
  model: string;
  extractedAt: string;
  elapsedMs: number;
}

export type LlmExtractionResult = LlmExtractionSuccess | LlmExtractionFailure;

function sanitizeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function sanitizeEmail(value: unknown): string | undefined {
  const cleaned = sanitizeText(value, 254);
  if (!cleaned) return undefined;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) return undefined;
  return cleaned.toLowerCase();
}

function sanitizePhone(value: unknown): string | undefined {
  const cleaned = sanitizeText(value, 32);
  if (!cleaned) return undefined;
  if (!/^[+\d()\-\s]{6,32}$/.test(cleaned)) return undefined;
  return cleaned;
}

function sanitizeConfidence(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const bounded = Math.max(0, Math.min(1, n));
  return Math.round(bounded * 1000) / 1000;
}

function sanitizeSuggestedEventType(value: unknown): string | undefined {
  const cleaned = sanitizeText(value, 48);
  if (!cleaned) return undefined;
  return cleaned
    .toLowerCase()
    .replace(/[^a-z_]/g, "")
    .slice(0, 48);
}

function sanitizeStringList(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const sanitized: string[] = [];
  for (const item of value) {
    const cleaned = sanitizeText(item, maxChars);
    if (cleaned) sanitized.push(cleaned);
    if (sanitized.length >= maxItems) break;
  }
  return sanitized;
}

function sanitizePotentialLead(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function sanitizeSuggestion(value: unknown): LeadSuggestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const input = value as Record<string, unknown>;
  return {
    company_name: sanitizeText(input.company_name, 180),
    contact_name: sanitizeText(input.contact_name, 120),
    email: sanitizeEmail(input.email),
    phone: sanitizePhone(input.phone),
    reason: sanitizeText(input.reason, MAX_FREEFORM_CHARS),
    suggested_event_type: sanitizeSuggestedEventType(input.suggested_event_type),
  };
}

export function sanitizeLeadAnalysis(value: unknown): LeadAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { entries: [], actions: [], potential_lead: null };
  }
  const input = value as Record<string, unknown>;
  return {
    entries: sanitizeStringList(input.entries, 20, 220),
    actions: sanitizeStringList(input.actions, 20, 220),
    potential_lead: sanitizePotentialLead(input.potential_lead),
    rationale: sanitizeText(input.rationale, MAX_FREEFORM_CHARS),
  };
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not include JSON object");
  }
  return text.slice(start, end + 1);
}

function countSuggestionFields(suggestion: LeadSuggestion): number {
  return Object.values(suggestion).filter((v) => typeof v === "string" && v.length > 0).length;
}

interface OllamaGenerateResponse {
  response?: string;
}

function buildPrompt(ocrText: string): string {
  const boundedText = ocrText.slice(0, 5000);
  return [
    "You extract lead hints from OCR text.",
    "Return ONLY valid JSON with no markdown and no additional keys.",
    "Required shape:",
    "{",
    '  "lead_suggestion": {',
    '    "company_name": string|null,',
    '    "contact_name": string|null,',
    '    "email": string|null,',
    '    "phone": string|null,',
    '    "reason": string|null,',
    '    "suggested_event_type": string|null',
    "  },",
    '  "lead_analysis": {',
    '    "entries": string[],',
    '    "actions": string[],',
    '    "potential_lead": boolean|null,',
    '    "rationale": string|null',
    "  },",
    '  "llm_confidence": number|null',
    "}",
    "Use null for unknown fields. Confidence must be between 0 and 1.",
    "OCR:",
    boundedText,
  ].join("\n");
}

function buildLeadCandidatesFromExtraction(params: {
  suggestion: LeadSuggestion;
  analysis: LeadAnalysis;
  confidence: number | null;
  model: string;
  elapsedMs: number;
  timeoutMs: number;
  fallbackUsed: boolean;
  llmError: boolean;
  minConfidence: number;
  ocrText: string;
}): LeadCandidatesPayloadV2 {
  const normalizedConfidence = typeof params.confidence === "number" ? params.confidence : 0;
  const reasons = [params.suggestion.reason, params.analysis.rationale]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 8);
  const intentType =
    typeof params.suggestion.suggested_event_type === "string" && params.suggestion.suggested_event_type.length > 0
      ? params.suggestion.suggested_event_type
      : "other";

  const snippets: LeadCandidateV2["evidence_snippets"] = [];
  if (params.ocrText.trim().length > 0) {
    snippets.push({ source: "ocr", text: params.ocrText.slice(0, 220) });
  }
  if (params.analysis.entries[0]) {
    snippets.push({ source: "llm", text: params.analysis.entries[0].slice(0, 220) });
  }
  if (params.analysis.actions[0]) {
    snippets.push({ source: "llm", text: params.analysis.actions[0].slice(0, 220) });
  }

  const qualityFlags = new Set<LeadCandidatesPayloadV2["quality_flags"][number]>();
  if (params.llmError) qualityFlags.add("llm_timeout");
  if (normalizedConfidence > 0 && normalizedConfidence < params.minConfidence) {
    qualityFlags.add("low_confidence");
  }
  if (params.ocrText.trim().length < 20) {
    qualityFlags.add("ocr_sparse");
  }

  const candidate: LeadCandidateV2 = {
    candidate_id: randomUUID(),
    intent_type: intentType,
    confidence: Math.max(0, Math.min(1, normalizedConfidence)),
    evidence_snippets: snippets.slice(0, 6),
    next_action: normalizedConfidence >= params.minConfidence ? "review" : "request_evidence",
    reasons,
    resolved_contact: null,
    resolution_candidates: [],
  };

  return {
    schema_version: "v2",
    lead_candidates: [candidate],
    model_meta: {
      provider: "ollama",
      model: params.model,
      prompt_version: "local_extractor_v2",
      schema_version: "v2",
      elapsed_ms: params.elapsedMs,
      timeout_ms: params.timeoutMs,
      fallback_used: params.fallbackUsed,
    },
    quality_flags: Array.from(qualityFlags),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.slice(0, 512);
  }
  return "LLM extraction failed";
}

export async function runLocalLlmExtraction(params: {
  endpoint: string;
  model: string;
  timeoutMs: number;
  ocrText: string;
  minConfidence: number;
}): Promise<LlmExtractionResult> {
  const startedAt = Date.now();
  const extractedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs).unref();

  try {
    const response = await fetch(`${params.endpoint.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: params.model,
        stream: false,
        prompt: buildPrompt(params.ocrText),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`LLM endpoint failed (${response.status})`);
    }
    const payload = (await response.json()) as OllamaGenerateResponse;
    const rawText = typeof payload.response === "string" ? payload.response : "";
    const jsonSlice = extractJsonObject(rawText);
    if (Buffer.byteLength(jsonSlice, "utf8") > MAX_SUGGESTION_JSON_BYTES) {
      throw new Error("LLM suggestion payload too large");
    }
    const parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
    const suggestion = sanitizeSuggestion(parsed.lead_suggestion);
    const analysis = sanitizeLeadAnalysis(parsed.lead_analysis);
    const confidence = sanitizeConfidence(parsed.llm_confidence);
    if (
      (confidence ?? 0) < params.minConfidence ||
      (countSuggestionFields(suggestion) === 0 && analysis.entries.length === 0 && analysis.actions.length === 0)
    ) {
      const elapsedMs = Date.now() - startedAt;
      return {
        ok: true,
        suggestion: {},
        analysis: { ...analysis, potential_lead: null },
        confidence,
        provider: "ollama",
        model: params.model,
        extractedAt,
        elapsedMs,
        leadCandidates: buildLeadCandidatesFromExtraction({
          suggestion: {},
          analysis: { ...analysis, potential_lead: null },
          confidence,
          model: params.model,
          elapsedMs,
          timeoutMs: params.timeoutMs,
          fallbackUsed: true,
          llmError: false,
          minConfidence: params.minConfidence,
          ocrText: params.ocrText,
        }),
      };
    }
    const elapsedMs = Date.now() - startedAt;
    return {
      ok: true,
      suggestion,
      analysis,
      confidence,
      provider: "ollama",
      model: params.model,
      extractedAt,
      elapsedMs,
      leadCandidates: buildLeadCandidatesFromExtraction({
        suggestion,
        analysis,
        confidence,
        model: params.model,
        elapsedMs,
        timeoutMs: params.timeoutMs,
        fallbackUsed: false,
        llmError: false,
        minConfidence: params.minConfidence,
        ocrText: params.ocrText,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      provider: "ollama",
      model: params.model,
      extractedAt,
      elapsedMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
