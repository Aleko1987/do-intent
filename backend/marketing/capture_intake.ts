import { api, APIError } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual, createHash } from "node:crypto";
import { applyCorrelationId } from "../internal/correlation";
import { applyCorsHeaders } from "../internal/cors";
import { resolveCaptureIntakeToken } from "../internal/env_secrets";
import type { JsonObject } from "../internal/json_types";
import { attachEvidenceToSignal, createCandidateSignalForOwner } from "./candidate_signal_intake_helpers";

const MAX_IMAGE_DATA_URL_BYTES = 8 * 1024 * 1024;
const MAX_METADATA_TEXT_BYTES = 12 * 1024;
const MAX_ERROR_BYTES = 512;
const MAX_MODEL_BYTES = 128;
const MAX_ENGINE_BYTES = 64;
const MAX_SUGGESTION_JSON_BYTES = 8 * 1024;

interface CaptureIntakeMetadata {
  source: "hotkey_capture";
  capture_mode: "region" | "fullscreen";
  capture_scope?: "region" | "fullscreen";
  captured_at: string;
  workstation_id?: string | null;
  app_version?: string | null;
  target_app_hint?: string | null;
  capture_correlation_id?: string | null;
  ocr_text?: string | null;
  ocr_confidence?: number | null;
  ocr_engine?: string | null;
  ocr_captured_at?: string | null;
  ocr_error?: string | null;
  ocr_ms?: number | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_confidence?: number | null;
  llm_extracted_at?: string | null;
  llm_error?: string | null;
  llm_ms?: number | null;
  lead_suggestion_json?: string | null;
  suggestion_state?: "none" | "suggested" | "approved" | "rejected";
  prefill_confidence_gate?: number | null;
}

interface CaptureIntakeRequest {
  version: "v1";
  idempotency_key: string;
  owner_user_id: string;
  channel: string;
  signal_type: string;
  summary?: string | null;
  raw_text?: string | null;
  image_data_url: string;
  mime_type: string;
  source_ref?: string | null;
  metadata: CaptureIntakeMetadata;
}

interface CaptureIntakeResponse {
  ok: boolean;
  deduped: boolean;
  candidate_signal_id: string;
  evidence_id: string | null;
  correlation_id: string;
}

interface CaptureIntakeDeps {
  resolveToken: () => string | null;
  createSignal: typeof createCandidateSignalForOwner;
  attachEvidence: typeof attachEvidenceToSignal;
}

function parseJsonBody(raw: string): unknown {
  if (!raw.trim()) {
    throw APIError.invalidArgument("request body is required");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw APIError.invalidArgument("invalid JSON body");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBoundedString(value: unknown, maxBytes: number): string | null {
  const parsed = parseString(value);
  if (!parsed) return null;
  if (Buffer.byteLength(parsed, "utf8") > maxBytes) {
    throw APIError.invalidArgument("metadata field exceeds max supported size");
  }
  return parsed;
}

function parseOptionalIsoString(value: unknown, label: string): string | null {
  const raw = parseString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw APIError.invalidArgument(`${label} must be ISO8601`);
  }
  return parsed.toISOString();
}

function parseBoundedNumber(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw APIError.invalidArgument(`${label} must be between ${min} and ${max}`);
  }
  return n;
}

function sanitizeLeadSuggestionObject(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const companyName = parseBoundedString(value.company_name, 180);
  const contactName = parseBoundedString(value.contact_name, 120);
  const email = parseBoundedString(value.email, 254);
  const phone = parseBoundedString(value.phone, 48);
  const reason = parseBoundedString(value.reason, 512);
  const suggestedEventType = parseBoundedString(value.suggested_event_type, 48);
  const result: Record<string, string> = {};
  if (companyName) result.company_name = companyName;
  if (contactName) result.contact_name = contactName;
  if (email) result.email = email;
  if (phone) result.phone = phone;
  if (reason) result.reason = reason;
  if (suggestedEventType) result.suggested_event_type = suggestedEventType;
  return result;
}

function parseLeadSuggestionJson(
  leadSuggestionValue: unknown,
  leadSuggestionJsonValue: unknown
): string | null {
  if (leadSuggestionValue !== undefined && leadSuggestionValue !== null) {
    const normalized = sanitizeLeadSuggestionObject(leadSuggestionValue);
    if (Object.keys(normalized).length === 0) return null;
    const json = JSON.stringify(normalized);
    if (Buffer.byteLength(json, "utf8") > MAX_SUGGESTION_JSON_BYTES) {
      throw APIError.invalidArgument("metadata.lead_suggestion exceeds max supported size");
    }
    return json;
  }

  const rawJson = parseBoundedString(leadSuggestionJsonValue, MAX_SUGGESTION_JSON_BYTES);
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson);
    const normalized = sanitizeLeadSuggestionObject(parsed);
    if (Object.keys(normalized).length === 0) return null;
    return JSON.stringify(normalized);
  } catch {
    throw APIError.invalidArgument("metadata.lead_suggestion_json must be valid JSON");
  }
}

function parseCaptureMode(value: unknown): "region" | "fullscreen" {
  if (value === "region" || value === "fullscreen") {
    return value;
  }
  throw APIError.invalidArgument("metadata.capture_mode must be region or fullscreen");
}

function parseCapturedAt(value: unknown): string {
  const raw = parseString(value);
  if (!raw) {
    throw APIError.invalidArgument("metadata.captured_at is required");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw APIError.invalidArgument("metadata.captured_at must be ISO8601");
  }
  return parsed.toISOString();
}

export function parseCaptureIntakePayload(payload: unknown): CaptureIntakeRequest {
  if (!isObject(payload)) {
    throw APIError.invalidArgument("request body must be an object");
  }

  const version = parseString(payload.version);
  if (version !== "v1") {
    throw APIError.invalidArgument("version must be v1");
  }

  const idempotencyKey = parseString(payload.idempotency_key);
  if (!idempotencyKey) {
    throw APIError.invalidArgument("idempotency_key is required");
  }
  const ownerUserId = parseString(payload.owner_user_id);
  if (!ownerUserId) {
    throw APIError.invalidArgument("owner_user_id is required");
  }
  const channel = parseString(payload.channel);
  if (!channel) {
    throw APIError.invalidArgument("channel is required");
  }
  const signalType = parseString(payload.signal_type);
  if (!signalType) {
    throw APIError.invalidArgument("signal_type is required");
  }
  const imageDataUrl = parseString(payload.image_data_url);
  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    throw APIError.invalidArgument("image_data_url must be a data:image/* URL");
  }
  if (Buffer.byteLength(imageDataUrl, "utf8") > MAX_IMAGE_DATA_URL_BYTES) {
    throw APIError.invalidArgument("image_data_url exceeds max supported size");
  }
  const mimeType = parseString(payload.mime_type);
  if (!mimeType || !mimeType.startsWith("image/")) {
    throw APIError.invalidArgument("mime_type must be image/*");
  }

  const metadataRaw = payload.metadata;
  if (!isObject(metadataRaw)) {
    throw APIError.invalidArgument("metadata is required");
  }
  const metadataSource = parseString(metadataRaw.source);
  if (metadataSource !== "hotkey_capture") {
    throw APIError.invalidArgument("metadata.source must be hotkey_capture");
  }
  const captureMode = parseCaptureMode(metadataRaw.capture_mode);
  const capturedAt = parseCapturedAt(metadataRaw.captured_at);
  const captureScope =
    metadataRaw.capture_scope === "fullscreen"
      ? "fullscreen"
      : metadataRaw.capture_scope === "region"
        ? "region"
        : captureMode;

  return {
    version: "v1",
    idempotency_key: idempotencyKey,
    owner_user_id: ownerUserId,
    channel,
    signal_type: signalType,
    summary: parseString(payload.summary),
    raw_text: parseString(payload.raw_text),
    image_data_url: imageDataUrl,
    mime_type: mimeType,
    source_ref: parseString(payload.source_ref),
    metadata: {
      source: "hotkey_capture",
      capture_mode: captureMode,
      capture_scope: captureScope,
      captured_at: capturedAt,
      workstation_id: parseString(metadataRaw.workstation_id),
      app_version: parseString(metadataRaw.app_version),
      target_app_hint: parseString(metadataRaw.target_app_hint),
      capture_correlation_id: parseBoundedString(metadataRaw.capture_correlation_id, 128),
      ocr_text: parseBoundedString(metadataRaw.ocr_text, MAX_METADATA_TEXT_BYTES),
      ocr_confidence: parseBoundedNumber(metadataRaw.ocr_confidence, "metadata.ocr_confidence", 0, 100),
      ocr_engine: parseBoundedString(metadataRaw.ocr_engine, MAX_ENGINE_BYTES),
      ocr_captured_at: parseOptionalIsoString(metadataRaw.ocr_captured_at, "metadata.ocr_captured_at"),
      ocr_error: parseBoundedString(metadataRaw.ocr_error, MAX_ERROR_BYTES),
      ocr_ms: parseBoundedNumber(metadataRaw.ocr_ms, "metadata.ocr_ms", 0, 120000),
      llm_provider: parseBoundedString(metadataRaw.llm_provider, 32),
      llm_model: parseBoundedString(metadataRaw.llm_model, MAX_MODEL_BYTES),
      llm_confidence: parseBoundedNumber(metadataRaw.llm_confidence, "metadata.llm_confidence", 0, 1),
      llm_extracted_at: parseOptionalIsoString(metadataRaw.llm_extracted_at, "metadata.llm_extracted_at"),
      llm_error: parseBoundedString(metadataRaw.llm_error, MAX_ERROR_BYTES),
      llm_ms: parseBoundedNumber(metadataRaw.llm_ms, "metadata.llm_ms", 0, 120000),
      lead_suggestion_json: parseLeadSuggestionJson(metadataRaw.lead_suggestion, metadataRaw.lead_suggestion_json),
      suggestion_state:
        metadataRaw.suggestion_state === "suggested"
          ? "suggested"
          : "none",
      prefill_confidence_gate: parseBoundedNumber(
        metadataRaw.prefill_confidence_gate,
        "metadata.prefill_confidence_gate",
        0,
        1
      ),
    },
  };
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    const length = Math.max(left.length, right.length);
    timingSafeEqual(
      Buffer.concat([left, Buffer.alloc(length - left.length)]),
      Buffer.concat([right, Buffer.alloc(length - right.length)])
    );
    return false;
  }
  return timingSafeEqual(left, right);
}

export function checkBearerToken(authorization: string | undefined, expected: string | null): boolean {
  if (!expected) return false;
  if (!authorization || !authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;
  return safeEquals(token, expected);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function buildCandidateMetadata(body: CaptureIntakeRequest, correlationId: string): JsonObject {
  return {
    source: "hotkey_capture",
    capture_mode: body.metadata.capture_mode,
    capture_scope: body.metadata.capture_scope ?? body.metadata.capture_mode,
    captured_at: body.metadata.captured_at,
    workstation_id: body.metadata.workstation_id ?? null,
    app_version: body.metadata.app_version ?? null,
    target_app_hint: body.metadata.target_app_hint ?? null,
    capture_correlation_id: body.metadata.capture_correlation_id ?? null,
    ocr_text: body.metadata.ocr_text ?? null,
    ocr_confidence: body.metadata.ocr_confidence ?? null,
    ocr_engine: body.metadata.ocr_engine ?? null,
    ocr_captured_at: body.metadata.ocr_captured_at ?? null,
    ocr_error: body.metadata.ocr_error ?? null,
    ocr_ms: body.metadata.ocr_ms ?? null,
    llm_provider: body.metadata.llm_provider ?? null,
    llm_model: body.metadata.llm_model ?? null,
    llm_confidence: body.metadata.llm_confidence ?? null,
    llm_extracted_at: body.metadata.llm_extracted_at ?? null,
    llm_error: body.metadata.llm_error ?? null,
    llm_ms: body.metadata.llm_ms ?? null,
    lead_suggestion_json: body.metadata.lead_suggestion_json ?? null,
    suggestion_state: body.metadata.suggestion_state ?? "none",
    prefill_confidence_gate: body.metadata.prefill_confidence_gate ?? null,
    ingestion_correlation_id: correlationId,
  };
}

function buildEvidenceMetadata(body: CaptureIntakeRequest, correlationId: string): JsonObject {
  const imageHash = createHash("sha256").update(body.image_data_url).digest("hex");
  return {
    ...buildCandidateMetadata(body, correlationId),
    image_sha256: imageHash,
    source_note: "Desktop hotkey capture",
  };
}

export function createCaptureIntakeHandler(deps: CaptureIntakeDeps) {
  return async function handleCaptureIntake(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const correlationId = applyCorrelationId(req, res);
    applyCorsHeaders(req, res);

    try {
      if ((req.method ?? "").toUpperCase() === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      const token = deps.resolveToken();
      const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : undefined;
      if (!checkBearerToken(authorization, token)) {
        throw APIError.unauthenticated("invalid capture intake token");
      }

      const rawBody = await readBody(req);
      const payload = parseCaptureIntakePayload(parseJsonBody(rawBody));
      const candidateMetadata = buildCandidateMetadata(payload, correlationId);
      const evidenceMetadata = buildEvidenceMetadata(payload, correlationId);

      const created = await deps.createSignal({
        ownerUserId: payload.owner_user_id,
        channel: payload.channel,
        sourceType: "operator",
        sourceRef: payload.source_ref ?? undefined,
        signalType: payload.signal_type,
        summary: payload.summary ?? undefined,
        rawText: payload.raw_text ?? undefined,
        dedupeKey: payload.idempotency_key,
        metadata: JSON.stringify(candidateMetadata),
        occurredAt: payload.metadata.captured_at,
      });

      if (created.deduped) {
        const dedupedResponse: CaptureIntakeResponse = {
          ok: true,
          deduped: true,
          candidate_signal_id: created.candidateSignal.id,
          evidence_id: null,
          correlation_id: correlationId,
        };
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(dedupedResponse));
        return;
      }

      const attached = await deps.attachEvidence({
        signalId: created.candidateSignal.id,
        ownerUserId: payload.owner_user_id,
        evidenceType: "screenshot",
        storageKind: "inline",
        evidenceRef: payload.image_data_url,
        mimeType: payload.mime_type,
        capturedAt: payload.metadata.captured_at,
        isSensitive: true,
        metadata: JSON.stringify(evidenceMetadata),
        createdByUserId: payload.owner_user_id,
        updateSignalStatus: false,
      });

      const responsePayload: CaptureIntakeResponse = {
        ok: true,
        deduped: false,
        candidate_signal_id: created.candidateSignal.id,
        evidence_id: attached.evidence.id,
        correlation_id: correlationId,
      };
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(responsePayload));
    } catch (error) {
      if (error instanceof APIError) {
        const status = error.code === "unauthenticated" ? 401 : error.code === "invalid_argument" ? 400 : 500;
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            code: error.code,
            message: error.message,
            correlation_id: correlationId,
          })
        );
        return;
      }

      console.error("[capture-intake] unexpected error", { correlation_id: correlationId, error });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          code: "internal",
          message: "internal error",
          correlation_id: correlationId,
        })
      );
    }
  };
}

const handleCaptureIntake = createCaptureIntakeHandler({
  resolveToken: resolveCaptureIntakeToken,
  createSignal: createCandidateSignalForOwner,
  attachEvidence: attachEvidenceToSignal,
});

export const captureIntake = api.raw(
  { expose: true, method: "POST", path: "/marketing/capture-intake" },
  handleCaptureIntake
);

export const captureIntakeOptions = api.raw(
  { expose: true, method: "OPTIONS", path: "/marketing/capture-intake" },
  async (req, res) => {
    applyCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
  }
);
