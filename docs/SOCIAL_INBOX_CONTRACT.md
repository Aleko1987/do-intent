# Social Inbox Contract (v1)

This document defines the cross-repo contract between DO-Intent (orchestrator)
and DO-Socials (execution adapter).

## Security

- **Service-to-service auth** is required.
- DO-Intent ingest endpoint requires:
  - `Authorization: Bearer ${DO_SOCIALS_INGEST_TOKEN}`
- DO-Intent execute outbound call uses:
  - `Authorization: Bearer ${DO_SOCIALS_EXECUTE_TOKEN}`

## A) NormalizedSocialEvent (DO-Socials -> DO-Intent)

```json
{
  "version": "v1",
  "source_event_id": "string",
  "platform": "facebook|instagram|whatsapp",
  "event_type": "inbound_message|comment|reply|mention|post_activity|profile_activity",
  "actor_ref": "string",
  "actor_display": "string|null",
  "lead_match_confidence": "number|null",
  "occurred_at": "ISO8601 string",
  "source_url": "string|null",
  "content_excerpt": "string|null",
  "metadata": {
    "owner_user_id": "required string for DO-Intent routing",
    "lead_id": "optional lead uuid",
    "priority": "optional numeric priority"
  }
}
```

Notes:
- `source_event_id` is idempotency key.
- DO-Intent dedupes by `(owner_user_id, source_event_id)`.

## B) ExecuteTaskRequest (DO-Intent -> DO-Socials)

```json
{
  "version": "v1",
  "task_id": "string",
  "idempotency_key": "string",
  "platform": "facebook|instagram|whatsapp",
  "action_type": "like|comment|reply|dm",
  "target_ref": "string",
  "lead_ref": "string|null",
  "content": "string|null",
  "metadata": {}
}
```

## C) ExecuteTaskResponse (DO-Socials -> DO-Intent)

```json
{
  "version": "v1",
  "task_id": "string",
  "status": "succeeded|failed|blocked|unsupported",
  "provider_action_id": "string|null",
  "occurred_at": "ISO8601 string",
  "reason_code": "string|null",
  "reason_message": "string|null",
  "raw": {}
}
```

## DO-Intent Endpoints

- `POST /social-events/ingest` (service-to-service, bearer required)
- `GET /inbox/tasks?status=&platform=&limit=`
- `POST /inbox/tasks/:id/approve`
- `POST /inbox/tasks/:id/reject`
- `POST /inbox/tasks/:id/execute`
- `GET /watchlists`
- `POST /watchlists`
- `POST /watchlists/:id`
- `DELETE /watchlists/:id`

## DO-Socials execute endpoint (called by DO-Intent)

DO-Intent calls:

- `POST /api/content-ops/social-execution/execute-task`

Configuration:
- `DO_SOCIALS_BASE_URL` (preferred, path appended automatically), or
- `DO_SOCIALS_EXECUTE_URL` (full override URL)
- `DO_SOCIALS_EXECUTE_TOKEN` (bearer token)

## Risk controls in DO-Intent

- Daily budget per `(owner_user_id, platform, action_type, date)`.
- Cooldown block if same `(platform, action_type, target_ref)` succeeded within
  the last 6 hours.
- Human approval first; blocked tasks are not executed.
