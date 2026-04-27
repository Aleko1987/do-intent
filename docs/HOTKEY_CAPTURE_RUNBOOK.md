# Hotkey Capture Intake Runbook

## Purpose

Enable operators to capture evidence from any foreground desktop application and submit it to DO-Intent as candidate signal intake evidence for human review.

## Components

- Desktop companion: `companion/`
- Backend intake endpoint: `POST /marketing/capture-intake`
- Review queue UI metadata display: `frontend/components/marketing/CandidateSignalReviewQueue.tsx`

## Setup

1. Set backend secret/environment:
   - `CAPTURE_INTAKE_TOKEN` (or Encore secret `CaptureIntakeToken`)
2. Start backend.
3. Configure companion environment variables:
   - `DO_INTENT_CAPTURE_BASE_URL`
   - `DO_INTENT_CAPTURE_TOKEN`
   - `DO_INTENT_OWNER_USER_ID`
   - Optional local extraction:
     - `DO_INTENT_OCR_ENABLED` (default `true`)
     - `DO_INTENT_LLM_ENABLED` (default `false`)
     - `DO_INTENT_LLM_ENDPOINT` (default `http://127.0.0.1:11434`)
     - `DO_INTENT_LLM_MODEL` (default `llama3.1:8b`)
     - `DO_INTENT_LLM_TIMEOUT_MS` (default `12000`)
     - `DO_INTENT_MIN_SUGGESTION_CONFIDENCE` (default `0.35`)
4. Start companion:
   - `cd companion`
   - `npm install`
   - `npm run dev`

## Manual Verification Script

1. Region capture -> appears in Review Queue with `Hotkey` provenance badge and metadata.
2. Full-screen capture (`qq`) -> appears in Review Queue with fullscreen provenance metadata.
3. Cancel region selection (`Esc` or invalid selection) -> no queue item created.
4. Network down -> capture is queued locally, then ingested after network recovers.
5. OCR failure -> capture still ingests with `ocr_error` metadata.
6. LLM timeout/failure -> capture still ingests with OCR metadata and `llm_error`.
7. Suggestion approval path:
   - Candidate rows appear in review queue with model provenance, resolver confidence, and OCR preview.
   - Lead is created/merged only when operator clicks Approve.
   - Reject keeps signal in candidate queue with `suggestion_state=rejected`.
8. Contact resolution path:
   - Import owner contacts from review queue (`CSV` or pasted text).
   - New captures resolve candidate names/handles against owner contacts with audit metadata.
   - Ambiguous matches are shown as alternatives; reviewer must still choose.

## Troubleshooting

- Hotkeys not detected:
  - Check for OS-level hotkey conflicts.
  - Run the companion with permissions required by the OS.
- Capture blocked/protected content:
  - Companion surfaces explicit error and does not enqueue invalid image data.
- Uploads rejected:
  - Verify `Authorization: Bearer` token and backend `CAPTURE_INTAKE_TOKEN`.

## Contract Compliance

### Request

`POST /marketing/capture-intake`

```json
{
  "version": "v1",
  "idempotency_key": "string",
  "owner_user_id": "string",
  "channel": "instagram|facebook|whatsapp|manual_upload|email|website",
  "signal_type": "post_published|inbound_message|other|...",
  "summary": "string|null",
  "raw_text": "string|null",
  "image_data_url": "data:image/png;base64,...",
  "mime_type": "image/png",
  "source_ref": "string|null",
  "metadata": {
    "source": "hotkey_capture",
    "capture_mode": "region|fullscreen",
    "capture_scope": "region|fullscreen",
    "captured_at": "ISO8601",
    "workstation_id": "string|null",
    "app_version": "string|null",
    "target_app_hint": "string|null"
    "capture_correlation_id": "string|null",
    "ocr_text": "string|null",
    "ocr_confidence": "number|null (0..100)",
    "ocr_engine": "string|null",
    "ocr_captured_at": "ISO8601|null",
    "ocr_error": "string|null",
    "ocr_ms": "number|null",
    "llm_provider": "string|null",
    "llm_model": "string|null",
    "llm_confidence": "number|null (0..1)",
    "llm_extracted_at": "ISO8601|null",
    "llm_error": "string|null",
    "llm_ms": "number|null",
    "llm_timeout_ms": "number|null",
    "lead_suggestion_json": "string|null",
    "lead_candidates_v2_json": "string|null (strict v2 lead_candidates payload)",
    "resolver_output_v2_json": "string|null (resolver match audit list)",
    "suggestion_state": "none|suggested (capture intake accepts only these values)",
    "prefill_confidence_gate": "number|null (0..1)"
  }
}
```

### Response (success)

```json
{
  "ok": true,
  "deduped": false,
  "candidate_signal_id": "uuid",
  "evidence_id": "uuid",
  "correlation_id": "uuid"
}
```

### Response (deduped)

```json
{
  "ok": true,
  "deduped": true,
  "candidate_signal_id": "uuid",
  "evidence_id": null,
  "correlation_id": "uuid"
}
```

### Response (auth/validation error)

```json
{
  "code": "unauthenticated|invalid_argument",
  "message": "string",
  "correlation_id": "uuid"
}
```

## DO-Socials Boundary

DO-Socials is not used in this ingestion step. Hotkey captures only create DO-Intent candidate signals/evidence for review. DO-Socials may only be involved later if a human-approved action enters execution workflows.

## Safety Notes

- Intake metadata cannot set suggestion lifecycle to `approved` or `rejected`; those states are only written by explicit review actions.
- Review queue approval/rejection calls authenticated candidate-signal review endpoints and records audit trail rows in `candidate_signal_reviews`.
- Promotion endpoint requires explicit approved status and valid owner lead before intent creation.
