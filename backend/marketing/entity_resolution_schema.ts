import { APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import type {
  LeadCandidateEvidenceSnippet,
  LeadCandidateIntentType,
  LeadCandidateQualityFlag,
  LeadCandidateV2,
  LeadCandidatesPayloadV2,
  OwnerContactDirectoryItem,
  OwnerContactImportMode,
  OwnerContactInputFormat,
  OwnerContactPlatform,
  OwnerContactSource,
  ResolverAuditV2,
  ResolverMatchMethod,
} from "./entity_resolution_contracts";

const MAX_TEXT_BYTES = 4096;
const MAX_SMALL_TEXT_BYTES = 256;
const MAX_REASON_ITEMS = 8;
const MAX_SNIPPET_ITEMS = 6;
const MAX_CANDIDATES = 5;
const MAX_JSON_BYTES = 24 * 1024;
const MAX_IMPORT_ERRORS = 100;

const ALLOWED_INTENT_TYPES = new Set<LeadCandidateIntentType>([
  "post_published",
  "link_clicked",
  "inbound_message",
  "quote_requested",
  "meeting_booked",
  "purchase_made",
  "other",
]);

const ALLOWED_QUALITY_FLAGS = new Set<LeadCandidateQualityFlag>([
  "llm_timeout",
  "low_confidence",
  "ocr_sparse",
  "resolver_ambiguous",
  "legacy_projection",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseString(value: unknown, maxBytes: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  if (Buffer.byteLength(normalized, "utf8") > maxBytes) {
    throw APIError.invalidArgument("field exceeds max supported size");
  }
  return normalized;
}

function parseNumber(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw APIError.invalidArgument(`numeric field must be in range ${min}..${max}`);
  }
  return Math.round(n * 1000) / 1000;
}

function parseStringArray(value: unknown, maxItems: number, maxBytes: number): string[] {
  if (!Array.isArray(value)) return [];
  const dedup = new Set<string>();
  for (const entry of value) {
    const parsed = parseString(entry, maxBytes);
    if (parsed) {
      dedup.add(parsed);
    }
    if (dedup.size >= maxItems) break;
  }
  return Array.from(dedup);
}

function normalizeIntentType(value: unknown): LeadCandidateIntentType {
  const parsed = parseString(value, 48)?.toLowerCase().replace(/[^a-z_]/g, "") ?? "other";
  if (ALLOWED_INTENT_TYPES.has(parsed as LeadCandidateIntentType)) {
    return parsed as LeadCandidateIntentType;
  }
  return "other";
}

function normalizeQualityFlags(value: unknown): LeadCandidateQualityFlag[] {
  if (!Array.isArray(value)) return [];
  const flags: LeadCandidateQualityFlag[] = [];
  for (const flag of value) {
    if (typeof flag !== "string") continue;
    if (ALLOWED_QUALITY_FLAGS.has(flag as LeadCandidateQualityFlag)) {
      flags.push(flag as LeadCandidateQualityFlag);
    }
  }
  return Array.from(new Set(flags)).slice(0, 8);
}

function parseEvidenceSnippets(value: unknown): LeadCandidateEvidenceSnippet[] {
  if (!Array.isArray(value)) return [];
  const snippets: LeadCandidateEvidenceSnippet[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    const source = entry.source === "ocr" || entry.source === "manual" ? entry.source : "llm";
    const text = parseString(entry.text, 220);
    if (!text) continue;
    snippets.push({ source, text });
    if (snippets.length >= MAX_SNIPPET_ITEMS) break;
  }
  return snippets;
}

function parseMethod(value: unknown): ResolverMatchMethod {
  if (value === "exact" || value === "prefix" || value === "fuzzy") {
    return value;
  }
  return "fuzzy";
}

export function parseLeadCandidatesV2FromUnknown(value: unknown): LeadCandidatesPayloadV2 | null {
  if (!isObject(value)) return null;
  if (value.schema_version !== "v2") return null;
  if (!Array.isArray(value.lead_candidates)) {
    throw APIError.invalidArgument("lead_candidates_v2.lead_candidates must be an array");
  }

  const candidates: LeadCandidateV2[] = [];
  for (const rawCandidate of value.lead_candidates) {
    if (!isObject(rawCandidate)) continue;
    const confidence = parseNumber(rawCandidate.confidence, 0, 1) ?? 0;
    const reasons = parseStringArray(rawCandidate.reasons, MAX_REASON_ITEMS, 220);
    const evidenceSnippets = parseEvidenceSnippets(rawCandidate.evidence_snippets);

    let resolvedContact: LeadCandidateV2["resolved_contact"] = null;
    if (isObject(rawCandidate.resolved_contact)) {
      const contactId = parseString(rawCandidate.resolved_contact.contact_id, 64);
      const displayName = parseString(rawCandidate.resolved_contact.display_name, 180);
      const method = parseMethod(rawCandidate.resolved_contact.method);
      const score = parseNumber(rawCandidate.resolved_contact.confidence, 0, 1);
      if (contactId && displayName && score !== null) {
        resolvedContact = {
          contact_id: contactId,
          display_name: displayName,
          confidence: score,
          method,
        };
      }
    }

    const resolutionCandidates: LeadCandidateV2["resolution_candidates"] = [];
    if (Array.isArray(rawCandidate.resolution_candidates)) {
      for (const option of rawCandidate.resolution_candidates) {
        if (!isObject(option)) continue;
        const contactId = parseString(option.contact_id, 64);
        const displayName = parseString(option.display_name, 180);
        const score = parseNumber(option.score, 0, 1);
        if (!contactId || !displayName || score === null) continue;
        resolutionCandidates.push({
          contact_id: contactId,
          display_name: displayName,
          score,
          method: parseMethod(option.method),
        });
        if (resolutionCandidates.length >= 5) break;
      }
    }

    candidates.push({
      candidate_id: parseString(rawCandidate.candidate_id, 64) ?? randomUUID(),
      intent_type: normalizeIntentType(rawCandidate.intent_type),
      confidence,
      evidence_snippets: evidenceSnippets,
      next_action:
        rawCandidate.next_action === "request_evidence" || rawCandidate.next_action === "defer"
          ? rawCandidate.next_action
          : "review",
      reasons,
      resolved_contact: resolvedContact,
      resolution_candidates: resolutionCandidates,
    });
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  const modelMetaRaw = isObject(value.model_meta) ? value.model_meta : {};
  const parsed: LeadCandidatesPayloadV2 = {
    schema_version: "v2",
    lead_candidates: candidates,
    model_meta: {
      provider: parseString(modelMetaRaw.provider, 64),
      model: parseString(modelMetaRaw.model, 128),
      prompt_version: parseString(modelMetaRaw.prompt_version, 64),
      schema_version: "v2",
      elapsed_ms: parseNumber(modelMetaRaw.elapsed_ms, 0, 120000),
      timeout_ms: parseNumber(modelMetaRaw.timeout_ms, 0, 120000),
      fallback_used: modelMetaRaw.fallback_used === true,
    },
    quality_flags: normalizeQualityFlags(value.quality_flags),
  };
  return parsed;
}

export function parseLeadCandidatesV2Json(
  directValue: unknown,
  jsonValue: unknown
): LeadCandidatesPayloadV2 | null {
  const parsedDirect = parseLeadCandidatesV2FromUnknown(directValue);
  if (parsedDirect) return parsedDirect;

  const jsonString = parseString(jsonValue, MAX_JSON_BYTES);
  if (!jsonString) return null;
  try {
    const parsed = JSON.parse(jsonString);
    const normalized = parseLeadCandidatesV2FromUnknown(parsed);
    if (!normalized) {
      throw APIError.invalidArgument("metadata.lead_candidates_v2_json must have schema_version=v2");
    }
    return normalized;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw APIError.invalidArgument("metadata.lead_candidates_v2_json must be valid JSON");
  }
}

export function serializeLeadCandidatesV2(payload: LeadCandidatesPayloadV2): string {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > MAX_JSON_BYTES) {
    throw APIError.invalidArgument("metadata.lead_candidates_v2 exceeds max supported size");
  }
  return serialized;
}

export function parseResolverAuditV2Json(value: unknown): ResolverAuditV2 | null {
  const raw = parseString(value, MAX_JSON_BYTES);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== "v2") {
      throw APIError.invalidArgument("metadata.resolver_output_v2_json must contain version=v2");
    }
    return parsed as ResolverAuditV2;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw APIError.invalidArgument("metadata.resolver_output_v2_json must be valid JSON");
  }
}

export function parseOwnerContactImportMode(value: unknown): OwnerContactImportMode {
  if (value === "full_refresh" || value === "delta") {
    return value;
  }
  throw APIError.invalidArgument("mode must be full_refresh or delta");
}

export function parseOwnerContactInputFormat(value: unknown): OwnerContactInputFormat {
  if (value === "csv" || value === "text") {
    return value;
  }
  throw APIError.invalidArgument("format must be csv or text");
}

export function parseOwnerContactSource(value: unknown): OwnerContactSource {
  if (value === "csv_upload" || value === "paste_text" || value === "api_refresh") {
    return value;
  }
  throw APIError.invalidArgument("source must be csv_upload, paste_text, or api_refresh");
}

export function parseOwnerContactPlatform(value: unknown): OwnerContactPlatform {
  if (
    value === "instagram" ||
    value === "facebook" ||
    value === "whatsapp" ||
    value === "email" ||
    value === "website" ||
    value === "manual_upload" ||
    value === "unknown"
  ) {
    return value;
  }
  throw APIError.invalidArgument(
    "platform must be instagram, facebook, whatsapp, email, website, manual_upload, or unknown"
  );
}

export function parseOwnerContactPayloadText(value: unknown): string {
  const parsed = parseString(value, 2 * 1024 * 1024);
  if (!parsed) {
    throw APIError.invalidArgument("payload is required");
  }
  return parsed;
}

export function parseOwnerContactLeadProbabilityScore(
  value: unknown,
  fallback = 0
): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw APIError.invalidArgument("lead_probability_score must be numeric");
  }
  const rounded = Math.round(n);
  if (rounded < 0 || rounded > 100) {
    throw APIError.invalidArgument("lead_probability_score must be between 0 and 100");
  }
  return rounded;
}

export function parseContactDirectoryListQuery(raw: {
  search?: string;
  limit?: number;
  include_inactive?: boolean;
  platform?: string;
}): {
  search: string | null;
  limit: number;
  includeInactive: boolean;
  platform: OwnerContactPlatform | null;
} {
  const search = parseString(raw.search, MAX_SMALL_TEXT_BYTES);
  const limitValue = raw.limit ?? 50;
  if (!Number.isInteger(limitValue) || limitValue <= 0) {
    throw APIError.invalidArgument("limit must be a positive integer");
  }
  return {
    search,
    limit: Math.min(limitValue, 5000),
    includeInactive: raw.include_inactive === true,
    platform: raw.platform ? parseOwnerContactPlatform(raw.platform) : null,
  };
}

export interface OwnerContactImportError {
  row: number;
  reason: string;
}

export function truncateImportErrors(errors: OwnerContactImportError[]): OwnerContactImportError[] {
  return errors.slice(0, MAX_IMPORT_ERRORS);
}

export function normalizeOwnerContactItem(row: OwnerContactDirectoryItem): OwnerContactDirectoryItem {
  return {
    ...row,
    aliases: row.aliases.slice(0, 12),
    emails: row.emails.slice(0, 12),
    phones: row.phones.slice(0, 12),
    handles: row.handles.slice(0, 12),
  };
}
