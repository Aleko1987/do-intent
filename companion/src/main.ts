import { app, dialog, Notification } from "electron";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { activeWindow } from "active-win";
import { GlobalKeyboardListener } from "node-global-key-listener";
import { loadConfig } from "./config.js";
import { HotkeyParser, type HotkeyAction } from "./hotkeys/hotkeyParser.js";
import { captureFullscreen, captureRegion } from "./capture/screenCapture.js";
import { selectRegion } from "./capture/regionOverlay.js";
import { RetryQueue } from "./queue/retryQueue.js";
import { postCaptureIntake } from "./intake/intakeClient.js";
import { runOcrFromDataUrl } from "./ocr/runOcr.js";
import { runLocalLlmExtraction, type LeadSuggestion } from "./extraction/localLlmExtractor.js";

function showError(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
    return;
  }
  void dialog.showErrorBox(title, body);
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { retryable?: boolean };
  return err.retryable === true;
}

async function detectTargetAppHint(): Promise<string | null> {
  try {
    const active = await activeWindow();
    if (!active) return null;
    const app = active.owner?.name ?? "unknown_app";
    const title = active.title ?? "unknown_window";
    return `${app}:${title}`.slice(0, 180);
  } catch {
    return null;
  }
}

function buildSummaryFromSuggestion(
  captureMode: "region" | "fullscreen",
  suggestion: LeadSuggestion,
  fallback: string
): string {
  const primary =
    suggestion.company_name ?? suggestion.contact_name ?? suggestion.suggested_event_type ?? fallback;
  return `${captureMode}: ${primary}`.slice(0, 240);
}

async function enrichCapturePayload(params: {
  imageDataUrl: string;
  captureMode: "region" | "fullscreen";
  capturedAt: string;
  correlationId: string;
  config: ReturnType<typeof loadConfig>;
}): Promise<{
  summary: string;
  rawText: string | null;
  metadata: Record<string, unknown>;
}> {
  const metadata: Record<string, unknown> = {};
  let rawText: string | null = null;
  let suggestion: LeadSuggestion = {};
  let leadAnalysis: {
    entries: string[];
    actions: string[];
    potential_lead: boolean | null;
    rationale?: string;
  } = { entries: [], actions: [], potential_lead: null };
  let llmConfidence: number | null = null;

  if (params.config.ocrEnabled) {
    const ocrResult = await runOcrFromDataUrl(params.imageDataUrl);
    if (ocrResult.ok) {
      rawText = ocrResult.text || null;
      metadata.ocr_text = ocrResult.text || null;
      metadata.ocr_confidence = ocrResult.confidence;
      metadata.ocr_engine = ocrResult.engine;
      metadata.ocr_captured_at = ocrResult.capturedAt;
      metadata.ocr_ms = ocrResult.elapsedMs;
      console.info("[companion] OCR completed", {
        correlationId: params.correlationId,
        elapsedMs: ocrResult.elapsedMs,
        confidence: ocrResult.confidence,
      });
    } else {
      metadata.ocr_error = ocrResult.error;
      metadata.ocr_engine = ocrResult.engine;
      metadata.ocr_captured_at = ocrResult.capturedAt;
      metadata.ocr_ms = ocrResult.elapsedMs;
      console.warn("[companion] OCR failed", {
        correlationId: params.correlationId,
        elapsedMs: ocrResult.elapsedMs,
        error: ocrResult.error,
      });
    }
  }

  if (params.config.llmEnabled && rawText) {
    const llmResult = await runLocalLlmExtraction({
      endpoint: params.config.llmEndpoint,
      model: params.config.llmModel,
      timeoutMs: params.config.llmTimeoutMs,
      ocrText: rawText,
      minConfidence: params.config.minSuggestionConfidence,
    });
    if (llmResult.ok) {
      suggestion = llmResult.suggestion;
      leadAnalysis = llmResult.analysis;
      llmConfidence = llmResult.confidence;
      metadata.llm_provider = llmResult.provider;
      metadata.llm_model = llmResult.model;
      metadata.llm_confidence = llmResult.confidence;
      metadata.llm_extracted_at = llmResult.extractedAt;
      metadata.llm_ms = llmResult.elapsedMs;
      metadata.lead_suggestion = Object.keys(llmResult.suggestion).length > 0 ? llmResult.suggestion : null;
      metadata.lead_suggestion_json =
        Object.keys(llmResult.suggestion).length > 0 ? JSON.stringify(llmResult.suggestion) : null;
      metadata.lead_analysis_json =
        llmResult.analysis.entries.length > 0 ||
        llmResult.analysis.actions.length > 0 ||
        llmResult.analysis.potential_lead !== null
          ? JSON.stringify(llmResult.analysis)
          : null;
      metadata.lead_candidates_v2_json = JSON.stringify(llmResult.leadCandidates);
      metadata.llm_timeout_ms = params.config.llmTimeoutMs;
      console.info("[companion] LLM extraction completed", {
        correlationId: params.correlationId,
        elapsedMs: llmResult.elapsedMs,
        confidence: llmResult.confidence,
        hasSuggestion:
          Object.keys(llmResult.suggestion).length > 0 ||
          llmResult.analysis.entries.length > 0 ||
          llmResult.analysis.actions.length > 0,
        potentialLead: llmResult.analysis.potential_lead,
      });
    } else {
      metadata.llm_provider = llmResult.provider;
      metadata.llm_model = llmResult.model;
      metadata.llm_extracted_at = llmResult.extractedAt;
      metadata.llm_ms = llmResult.elapsedMs;
      metadata.llm_error = llmResult.error;
      metadata.llm_timeout_ms = params.config.llmTimeoutMs;
      console.warn("[companion] LLM extraction failed", {
        correlationId: params.correlationId,
        elapsedMs: llmResult.elapsedMs,
        error: llmResult.error,
      });
    }
  }

  metadata.suggestion_state =
    Object.keys(suggestion).length > 0 || leadAnalysis.potential_lead === true ? "suggested" : "none";
  const summary = buildSummaryFromSuggestion(
    params.captureMode,
    suggestion,
    `Hotkey ${params.captureMode} capture`
  );
  if (llmConfidence != null) {
    metadata.prefill_confidence_gate = params.config.minSuggestionConfidence;
  }

  return {
    summary,
    rawText,
    metadata,
  };
}

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const hotkeys = new HotkeyParser({
    holdThresholdMs: config.holdThresholdMs,
    doublePressWindowMs: config.doublePressWindowMs,
  });
  const queueDir = path.join(app.getPath("userData"), "queue");
  const retryQueue = new RetryQueue(queueDir);
  await retryQueue.init();
  let flushInProgress = false;

  const flushQueue = async () => {
    if (flushInProgress) {
      return;
    }
    flushInProgress = true;
    const due = retryQueue.listDue(Date.now());
    try {
      if (due.length > 0) {
        console.info("[companion] flushing queue", { due: due.length });
      }
      for (const item of due) {
        try {
          const startedAtMs = Date.now();
          const intakeResponse = await postCaptureIntake({
            baseUrl: config.intakeBaseUrl,
            token: config.intakeToken,
            payload: item.payload,
          });
          await retryQueue.markSucceeded(item.idempotencyKey);
          console.info("[companion] intake success", {
            idempotencyKey: item.idempotencyKey,
            deduped: intakeResponse.deduped,
            candidateSignalId: intakeResponse.candidate_signal_id,
            evidenceId: intakeResponse.evidence_id,
            intakeMs: Date.now() - startedAtMs,
          });
        } catch (error) {
          console.error("[companion] intake failed", {
            idempotencyKey: item.idempotencyKey,
            message: error instanceof Error ? error.message : String(error),
          });
          if (isRetryableError(error)) {
            await retryQueue.markFailed(
              item.idempotencyKey,
              error instanceof Error ? error.message : "retryable ingest error"
            );
            continue;
          }
          await retryQueue.markFailed(
            item.idempotencyKey,
            error instanceof Error ? error.message : "non-retryable ingest error"
          );
        }
      }
    } finally {
      flushInProgress = false;
    }
  };

  const enqueueCapture = async (captureMode: "region" | "fullscreen", imageDataUrl: string, mimeType: string) => {
    const correlationId = randomUUID();
    const capturedAt = new Date().toISOString();
    const enrichment = await enrichCapturePayload({
      imageDataUrl,
      captureMode,
      capturedAt,
      correlationId,
      config,
    });
    const payload = {
      version: "v1",
      idempotency_key: randomUUID(),
      owner_user_id: config.ownerUserId,
      channel: config.defaultChannel,
      signal_type: config.defaultSignalType,
      summary: enrichment.summary,
      raw_text: enrichment.rawText,
      image_data_url: imageDataUrl,
      mime_type: mimeType,
      source_ref: null,
      metadata: {
        source: "hotkey_capture",
        capture_mode: captureMode,
        capture_scope: captureMode,
        captured_at: capturedAt,
        workstation_id: config.workstationId,
        app_version: config.appVersion,
        target_app_hint: await detectTargetAppHint(),
        capture_correlation_id: correlationId,
        ...enrichment.metadata,
      },
    } satisfies Record<string, unknown>;

    const idempotencyKey = payload.idempotency_key as string;
    await retryQueue.enqueue(payload, idempotencyKey);
    console.info("[companion] queued capture", {
      captureMode,
      idempotencyKey,
      mimeType,
      bytes: imageDataUrl.length,
    });
    await flushQueue();
  };

  let regionSelectionPromise: Promise<Awaited<ReturnType<typeof selectRegion>>> | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let qDown = false;
  const keyboard = new GlobalKeyboardListener();

  const handleAction = async (action: HotkeyAction) => {
    try {
      console.info("[companion] action", action.type);
      if (action.type === "fullscreen_capture") {
        console.info("[companion] starting fullscreen capture");
        const result = await captureFullscreen({
          allMonitors: config.captureAllMonitors,
          maxBytes: config.maxImageBytes,
        });
        console.info("[companion] fullscreen capture completed", {
          mimeType: result.mimeType,
          bytes: result.dataUrl.length,
        });
        await enqueueCapture("fullscreen", result.dataUrl, result.mimeType);
        return;
      }

      if (action.type === "region_start") {
        if (!regionSelectionPromise) {
          console.info("[companion] opening region overlay");
          regionSelectionPromise = selectRegion();
        }
        return;
      }

      if (action.type === "region_finalize") {
        if (!regionSelectionPromise) {
          console.warn("[companion] region finalize without active overlay");
          return;
        }
        const rect = await regionSelectionPromise;
        regionSelectionPromise = null;
        if (!rect) {
          console.info("[companion] region selection canceled");
          return;
        }
        console.info("[companion] region selected", rect);
        const result = await captureRegion({ rect, maxBytes: config.maxImageBytes });
        console.info("[companion] region capture completed", {
          mimeType: result.mimeType,
          bytes: result.dataUrl.length,
        });
        await enqueueCapture("region", result.dataUrl, result.mimeType);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Capture failed";
      console.error("[companion] action failed", {
        action: action.type,
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      showError("Hotkey Capture Error", message);
    }
  };

  const keyboardListener = (event: {
    name?: string;
    rawKey?: { _nameRaw?: string; name?: string; standardName?: string };
    vKey?: number;
    state: "UP" | "DOWN";
  }) => {
    const keyName = event.name ?? event.rawKey?.standardName ?? event.rawKey?.name ?? "";
    const isQ = keyName.toUpperCase() === "Q" || event.vKey === 0x51;
    if (!isQ) return;

    if (event.state === "DOWN") {
      if (qDown) {
        // Ignore repeated keydown events while holding to avoid log spam/noise.
        return;
      }
      console.info("[companion] key event", {
        keyName,
        vKey: event.vKey,
        state: event.state,
        qDown,
      });
      qDown = true;

      const actions = hotkeys.onQKeyDown(Date.now());
      for (const action of actions) {
        void handleAction(action);
      }
      if (holdTimer) {
        clearTimeout(holdTimer);
      }
      holdTimer = setTimeout(() => {
        const tickActions = hotkeys.onTick(Date.now());
        for (const action of tickActions) {
          void handleAction(action);
        }
      }, config.holdThresholdMs);
      return;
    }

    if (!qDown) {
      return;
    }
    console.info("[companion] key event", {
      keyName,
      vKey: event.vKey,
      state: event.state,
      qDown,
    });
    qDown = false;

    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    const actions = hotkeys.onQKeyUp(Date.now());
    for (const action of actions) {
      void handleAction(action);
    }
  };

  keyboard.addListener(keyboardListener);

  setInterval(() => {
    void flushQueue();
  }, 5000).unref();

  let isQuitting = false;
  app.on("before-quit", () => {
    isQuitting = true;
    keyboard.removeListener(keyboardListener);
  });

  // Keep running as a background utility after overlay windows close.
  app.on("window-all-closed", () => {
    if (isQuitting) {
      return;
    }
    // Intentionally no-op: registering this listener prevents default auto-quit.
  });

  console.info("[companion] started", {
    platform: os.platform(),
    release: os.release(),
  });
}

app.whenReady().then(() => {
  void bootstrap();
});

process.on("unhandledRejection", (reason) => {
  console.error("[companion] unhandled rejection", reason);
});
