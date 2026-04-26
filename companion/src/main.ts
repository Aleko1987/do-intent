import { app, dialog, Notification } from "electron";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { activeWindow } from "active-win";
import { GlobalKeyboardListener } from "node-global-key-listener";
import { loadConfig } from "./config";
import { HotkeyParser, type HotkeyAction } from "./hotkeys/hotkeyParser";
import { captureFullscreen, captureRegion } from "./capture/screenCapture";
import { selectRegion } from "./capture/regionOverlay";
import { RetryQueue } from "./queue/retryQueue";
import { postCaptureIntake } from "./intake/intakeClient";

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

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const hotkeys = new HotkeyParser({
    holdThresholdMs: config.holdThresholdMs,
    doublePressWindowMs: config.doublePressWindowMs,
  });
  const queueDir = path.join(app.getPath("userData"), "queue");
  const retryQueue = new RetryQueue(queueDir);
  await retryQueue.init();

  const flushQueue = async () => {
    const due = retryQueue.listDue(Date.now());
    for (const item of due) {
      try {
        await postCaptureIntake({
          baseUrl: config.intakeBaseUrl,
          token: config.intakeToken,
          payload: item.payload,
        });
        await retryQueue.markSucceeded(item.idempotencyKey);
      } catch (error) {
        if (isRetryableError(error)) {
          await retryQueue.markFailed(
            item.idempotencyKey,
            error instanceof Error ? error.message : "retryable ingest error"
          );
          continue;
        }
        await retryQueue.markSucceeded(item.idempotencyKey);
      }
    }
  };

  const enqueueCapture = async (captureMode: "region" | "fullscreen", imageDataUrl: string, mimeType: string) => {
    const capturedAt = new Date().toISOString();
    const payload = {
      version: "v1",
      idempotency_key: randomUUID(),
      owner_user_id: config.ownerUserId,
      channel: config.defaultChannel,
      signal_type: config.defaultSignalType,
      summary: `Hotkey ${captureMode} capture`,
      raw_text: null,
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
      },
    } satisfies Record<string, unknown>;

    const idempotencyKey = payload.idempotency_key as string;
    await retryQueue.enqueue(payload, idempotencyKey);
    await flushQueue();
  };

  let regionSelectionPromise: Promise<Awaited<ReturnType<typeof selectRegion>>> | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  const keyboard = new GlobalKeyboardListener();

  const handleAction = async (action: HotkeyAction) => {
    try {
      if (action.type === "fullscreen_capture") {
        const result = await captureFullscreen({
          allMonitors: config.captureAllMonitors,
          maxBytes: config.maxImageBytes,
        });
        await enqueueCapture("fullscreen", result.dataUrl, result.mimeType);
        return;
      }

      if (action.type === "region_start") {
        if (!regionSelectionPromise) {
          regionSelectionPromise = selectRegion();
        }
        return;
      }

      if (action.type === "region_finalize") {
        if (!regionSelectionPromise) {
          return;
        }
        const rect = await regionSelectionPromise;
        regionSelectionPromise = null;
        if (!rect) {
          return;
        }
        const result = await captureRegion({ rect, maxBytes: config.maxImageBytes });
        await enqueueCapture("region", result.dataUrl, result.mimeType);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Capture failed";
      showError("Hotkey Capture Error", message);
    }
  };

  const keyboardListener = (event: { name: string; state: "UP" | "DOWN" }) => {
    if (event.name !== "Q") return;
    if (event.state === "DOWN") {
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

  app.on("before-quit", () => {
    keyboard.removeListener(keyboardListener);
  });

  console.info("[companion] started", {
    platform: os.platform(),
    release: os.release(),
  });
}

app.whenReady().then(() => {
  void bootstrap();
});
