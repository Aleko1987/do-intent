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

export interface LlmExtractionSuccess {
  ok: true;
  suggestion: LeadSuggestion;
  confidence: number | null;
  provider: "ollama";
  model: string;
  extractedAt: string;
  elapsedMs: number;
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
    '  "llm_confidence": number|null',
    "}",
    "Use null for unknown fields. Confidence must be between 0 and 1.",
    "OCR:",
    boundedText,
  ].join("\n");
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
    const confidence = sanitizeConfidence(parsed.llm_confidence);
    if ((confidence ?? 0) < params.minConfidence || countSuggestionFields(suggestion) === 0) {
      return {
        ok: true,
        suggestion: {},
        confidence,
        provider: "ollama",
        model: params.model,
        extractedAt,
        elapsedMs: Date.now() - startedAt,
      };
    }
    return {
      ok: true,
      suggestion,
      confidence,
      provider: "ollama",
      model: params.model,
      extractedAt,
      elapsedMs: Date.now() - startedAt,
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
