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
4. Start companion:
   - `cd companion`
   - `npm install`
   - `npm run dev`

## Manual Verification Script

1. Region capture -> appears in Review Queue with `Hotkey` provenance badge and metadata.
2. Full-screen capture (`qq`) -> appears in Review Queue with fullscreen provenance metadata.
3. Cancel region selection (`Esc` or invalid selection) -> no queue item created.
4. Network down -> capture is queued locally, then ingested after network recovers.

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
