import { randomUUID } from "node:crypto";

const MAX_SUGGESTION_JSON_BYTES = 16 * 1024;
const MAX_FREEFORM_CHARS = 500;
const PROMPT_VERSION = "local_extractor_v3";

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

export interface SocialCaptureActor {
  handle: string | null;
  display_name: string | null;
}

export interface SocialCapture {
  modal_type: string | null;
  signal_type: string | null;
  actors: SocialCaptureActor[];
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
  socialCapture: SocialCapture;
  confidence: number | null;
  provider: "ollama";
  model: string;
  extractedAt: string;
  elapsedMs: number;
  leadCandidates: LeadCandidatesPayloadV2;
  usedVision: boolean;
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

function sanitizeInstagramHandle(value: unknown): string | null {
  const cleaned = sanitizeText(value, 64);
  if (!cleaned) return null;
  const handle = cleaned.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_.]/g, "");
  return handle.length >= 3 ? handle : null;
}

export function sanitizeSocialCapture(value: unknown): SocialCapture {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { modal_type: null, signal_type: null, actors: [] };
  }
  const input = value as Record<string, unknown>;
  const actors: SocialCaptureActor[] = [];
  const seen = new Set<string>();
  if (Array.isArray(input.actors)) {
    for (const row of input.actors.slice(0, 24)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;
      const handle = sanitizeInstagramHandle(record.handle ?? record.username);
      const displayName = sanitizeText(record.display_name ?? record.displayName, 120) ?? null;
      const key = handle || displayName?.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      actors.push({ handle, display_name: displayName });
    }
  }
  return {
    modal_type: sanitizeText(input.modal_type, 64)?.toLowerCase() ?? null,
    signal_type: sanitizeSuggestedEventType(input.signal_type) ?? null,
    actors,
  };
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

function socialCaptureJsonSchema(): string[] {
  return [
    '  "social_capture": {',
    '    "modal_type": "instagram_likes"|"facebook_reactions"|"instagram_follow_list"|"other"|null,',
    '    "signal_type": "like"|"follow"|"comment"|"share"|"other"|null,',
    '    "actors": [',
    '      { "handle": string|null, "display_name": string|null }',
    "    ]",
    "  },",
  ];
}

function buildTextPrompt(ocrText: string): string {
  const boundedText = ocrText.slice(0, 5000);
  return [
    "You extract structured social engagement data from noisy OCR text.",
    "Focus on Instagram/Facebook likes or reactions modals.",
    "Each actor is one account row: username/handle plus optional display name.",
    "Ignore browser chrome, Follow buttons, Likes headers, and UI junk.",
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
    ...socialCaptureJsonSchema(),
    '  "llm_confidence": number|null',
    "}",
    "Rules:",
    "- Put one object in social_capture.actors per visible account row.",
    "- handle is the username without @.",
    "- display_name is the human-readable name when visible, else null.",
    "- Do not merge multiple people into one actor.",
    "- Do not invent people not supported by OCR.",
    "OCR:",
    boundedText,
  ].join("\n");
}

function buildVisionPrompt(): string {
  return [
    "You analyze a screenshot of a social media app (Instagram or Facebook).",
    "Extract every visible account/person row from a Likes, Reactions, or Follow list modal.",
    "Return ONLY valid JSON with no markdown and no additional keys.",
    "Required shape:",
    "{",
    '  "lead_suggestion": {',
    '    "company_name": null,',
    '    "contact_name": null,',
    '    "email": null,',
    '    "phone": null,',
    '    "reason": null,',
    '    "suggested_event_type": null',
    "  },",
    '  "lead_analysis": {',
    '    "entries": string[],',
    '    "actions": string[],',
    '    "potential_lead": boolean|null,',
    '    "rationale": string|null',
    "  },",
    ...socialCaptureJsonSchema(),
    '  "llm_confidence": number|null',
    "}",
    "Rules:",
    "- One actor per visible row in the modal list.",
    "- handle is the username without @ (bold top line on Instagram).",
    "- display_name is the gray secondary line when present, else null.",
    "- Ignore Follow buttons, modal title, and close icon.",
    "- Do not invent accounts that are not visibly listed.",
  ].join("\n");
}

function dataUrlToBase64(dataUrl: string): string | null {
  const match = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(dataUrl.trim());
  return match?.[1] ?? null;
}

function buildLeadCandidatesFromExtraction(params: {
  suggestion: LeadSuggestion;
  analysis: LeadAnalysis;
  socialCapture: SocialCapture;
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
    params.socialCapture.signal_type
    || (typeof params.suggestion.suggested_event_type === "string" && params.suggestion.suggested_event_type.length > 0
      ? params.suggestion.suggested_event_type
      : "other");

  const snippets: LeadCandidateV2["evidence_snippets"] = [];
  if (params.ocrText.trim().length > 0) {
    snippets.push({ source: "ocr", text: params.ocrText.slice(0, 220) });
  }
  for (const actor of params.socialCapture.actors.slice(0, 3)) {
    const label = actor.display_name
      ? `${actor.display_name}${actor.handle ? ` (@${actor.handle})` : ""}`
      : actor.handle
        ? `@${actor.handle}`
        : null;
    if (label) snippets.push({ source: "llm", text: label.slice(0, 220) });
  }
  if (params.analysis.entries[0]) {
    snippets.push({ source: "llm", text: params.analysis.entries[0].slice(0, 220) });
  }

  const qualityFlags = new Set<LeadCandidatesPayloadV2["quality_flags"][number]>();
  if (params.llmError) qualityFlags.add("llm_timeout");
  if (normalizedConfidence > 0 && normalizedConfidence < params.minConfidence && params.socialCapture.actors.length === 0) {
    qualityFlags.add("low_confidence");
  }
  if (params.ocrText.trim().length < 20 && params.socialCapture.actors.length === 0) {
    qualityFlags.add("ocr_sparse");
  }

  const candidate: LeadCandidateV2 = {
    candidate_id: randomUUID(),
    intent_type: intentType,
    confidence: Math.max(0, Math.min(1, normalizedConfidence)),
    evidence_snippets: snippets.slice(0, 6),
    next_action: normalizedConfidence >= params.minConfidence || params.socialCapture.actors.length > 0 ? "review" : "request_evidence",
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
      prompt_version: PROMPT_VERSION,
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
  imageDataUrl?: string | null;
  useVision?: boolean;
}): Promise<LlmExtractionResult> {
  const startedAt = Date.now();
  const extractedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs).unref();
  const imageBase64 = params.useVision && params.imageDataUrl ? dataUrlToBase64(params.imageDataUrl) : null;
  const usedVision = Boolean(imageBase64);

  try {
    const body: Record<string, unknown> = {
      model: params.model,
      stream: false,
      prompt: usedVision ? buildVisionPrompt() : buildTextPrompt(params.ocrText),
    };
    if (imageBase64) {
      body.images = [imageBase64];
    }
    const response = await fetch(`${params.endpoint.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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
    const socialCapture = sanitizeSocialCapture(parsed.social_capture);
    const confidence = sanitizeConfidence(parsed.llm_confidence);
    const hasSocialActors = socialCapture.actors.length > 0;
    if (
      !hasSocialActors
      && (
        (confidence ?? 0) < params.minConfidence
        || (countSuggestionFields(suggestion) === 0 && analysis.entries.length === 0 && analysis.actions.length === 0)
      )
    ) {
      const elapsedMs = Date.now() - startedAt;
      return {
        ok: true,
        suggestion: {},
        analysis: { ...analysis, potential_lead: null },
        socialCapture,
        confidence,
        provider: "ollama",
        model: params.model,
        extractedAt,
        elapsedMs,
        usedVision,
        leadCandidates: buildLeadCandidatesFromExtraction({
          suggestion: {},
          analysis: { ...analysis, potential_lead: null },
          socialCapture,
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
      socialCapture,
      confidence,
      provider: "ollama",
      model: params.model,
      extractedAt,
      elapsedMs,
      usedVision,
      leadCandidates: buildLeadCandidatesFromExtraction({
        suggestion,
        analysis,
        socialCapture,
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
