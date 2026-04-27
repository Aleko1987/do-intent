# DO-Intent Hotkey Companion (Windows-first)

This desktop companion captures cross-application screenshots with global hotkeys and sends them to DO-Intent review intake.

## Scope

- Ingestion target: `POST /marketing/capture-intake` on DO-Intent.
- Human review gate remains mandatory in DO-Intent.
- DO-Socials is not used in this ingestion step.

## Hotkeys

- Hold `q`: triggers region capture flow.
- Press `qq` quickly (default 350ms): triggers full-screen capture.

## Required Environment Variables

- `DO_INTENT_CAPTURE_BASE_URL` (example: `http://localhost:4000`)
- `DO_INTENT_CAPTURE_TOKEN` (Bearer token expected by DO-Intent capture endpoint)
- `DO_INTENT_OWNER_USER_ID` (owner user id to attach candidate signal)

## Optional Environment Variables

- `DO_INTENT_CAPTURE_CHANNEL` (default: `manual_upload`)
- `DO_INTENT_CAPTURE_SIGNAL_TYPE` (default: `other`)
- `DO_INTENT_CAPTURE_ALL_MONITORS` (`true`/`false`, default `false`)
- `DO_INTENT_DOUBLE_PRESS_MS` (default `350`)
- `DO_INTENT_HOLD_THRESHOLD_MS` (default `180`)
- `DO_INTENT_CAPTURE_MAX_BYTES` (default `4194304`)
- `DO_INTENT_WORKSTATION_ID` (optional provenance field)
- `DO_INTENT_CAPTURE_APP_VERSION` (default `1.0.0`)
- `DO_INTENT_OCR_ENABLED` (`true`/`false`, default `true`)
- `DO_INTENT_LLM_ENABLED` (`true`/`false`, default `false`)
- `DO_INTENT_LLM_ENDPOINT` (default `http://127.0.0.1:11434`)
- `DO_INTENT_LLM_MODEL` (default `llama3.1:8b`)
- `DO_INTENT_LLM_TIMEOUT_MS` (default `12000`)
- `DO_INTENT_MIN_SUGGESTION_CONFIDENCE` (`0..1`, default `0.35`)

To enable local LLM extraction, set `DO_INTENT_LLM_ENABLED=true` and ensure Ollama is running at `DO_INTENT_LLM_ENDPOINT`.

## Run

```bash
cd companion
npm install
npm run dev
```

## Retry Queue

Failed uploads are persisted in the app data queue file and retried with exponential backoff.

## Troubleshooting

- If global hotkeys do not fire, run the process with elevated permissions and ensure no system-level hotkey conflict.
- If screenshot capture fails with protected content, the app shows an explicit error and does not enqueue corrupted payloads.
- If uploads fail, verify token validity and backend availability.
