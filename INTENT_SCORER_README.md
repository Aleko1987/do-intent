# Intent Scorer Service - Implementation Summary

## Overview

The Intent Scorer is a deterministic, rule-based scoring engine that processes intent events, computes scores with full explainability, and supports anonymous-first website tracking. It operates independently from the marketing module while reusing the same Postgres database.

## Architecture

### Intent Scoring Schema (Migration 004/013)

**intent_scores**
- Links to intent_events (one-to-one via unique constraint)
- Stores computed score, confidence, and reasoning breakdown
- Tracks model version for future iterations

**lead_intent_rollups**
- Per-lead aggregations with 7-day and 30-day rolling windows
- Automatically updated when events are scored
- Tracks last event timestamp

**intent_rules**
- Configurable scoring rules (base scores + modifiers)
- Supports dynamic point values and enable/disable toggles
- Pre-seeded with standard event types

### Website Tracking Schema (Migration 006)

**sessions / events / identities**
- Anonymous-first tracking tables
- Events are append-only and later promoted to identities

**intent_subject_scores**
- Incremental scores for anonymous + identity subjects
- Tracks last threshold emitted for signal gating

### Backend Service (`backend/intent_scorer/`)

**Core Files:**
- `encore.service.ts` - Service definition
- `types.ts` - TypeScript interfaces and types
- `engine.ts` - Deterministic scoring logic (rules v1)
- `auto_score.ts` - Auto-scoring on event insert
- `track.ts` - Website tracking endpoint
- `identify.ts` - Anonymous -> identity promotion
- `health.ts` - /health + /ready endpoints

**API Endpoints:**
Scoring + rules:
- `POST /intent-scorer/events`
- `POST /intent-scorer/compute`
- `POST /intent-scorer/recompute`
- `GET /intent-scorer/rules`
- `POST /intent-scorer/rules/update`

Lead insights:
- `POST /intent-scorer/leads` (Clerk auth required)
- `POST /intent-scorer/leads/public` (requires `DISABLE_AUTH_FOR_INTENT_LIST=true`)
- `POST /intent-scorer/lead-rollups`
- `POST /intent-scorer/lead-trend`
- `POST /intent-scorer/lead-top-signals`
- `POST /intent-scorer/seed-demo`

Website tracking:
- `POST /track` / `POST /api/v1/track`
- `POST /identify` / `POST /api/v1/identify`

Health:
- `GET /health`, `GET /ready`, `GET /api/v1/ready`
- `GET /intent-scorer/ping`

### Scoring Engine (Rules V1)

**Base Scores by Event Type:**
- `post_published`: +1
- `link_clicked`: +5
- `inbound_message`: +8
- `quote_requested`: +15
- `meeting_booked`: +20
- `purchase_made`: +50

**Modifiers:**
- UTM medium = social: +1
- Reach >= 5000: +2
- Clicks in payload: +min(clicks, 20)

**Confidence Logic:**
- CRM/Website source: 0.85
- Content Ops source: 0.7
- Missing fields or other sources: 0.55

**Reasons Array:**
Each score includes an array of human-readable strings explaining the calculation, e.g.:
```json
[
  "Base score for link_clicked: +5",
  "UTM medium is social: +1",
  "Confidence reduced due to missing fields"
]
```

### Frontend UI

- `/intent-scorer`: Leads, Events, Scores, Rules tabs
- `/lead-intent`: lead-level rollups + drawer

### Auto-Scoring Integration

The intent scorer is automatically triggered when events are created via:
- `/marketing/leads/:id/events` (create_event.ts)
- `/marketing/events` (webhook_event.ts)
- `/marketing/ingest-intent-event` (website ingestion)

Flow:
1. Event created in `intent_events`
2. `autoScoreEvent()` called
3. Score computed using active rules
4. Score stored in `intent_scores`
5. Lead rollup updated (7d/30d)

## Usage

### Accessing the UI

Navigate to `/intent-scorer` or `/lead-intent`.

### Manual Scoring

1. Go to the Scores tab
2. Set the number of days to recompute (default: 30)
3. Click "Run Scoring"

### Editing Rules

1. Go to the Rules tab
2. Click "Edit" on any base score or modifier
3. Change the points value or description
4. Click "Save"
5. Recompute scores to apply changes

### API Examples

**List Events:**
```typescript
POST /intent-scorer/events
{
  "source": "website",
  "event_type": "link_clicked",
  "from_date": "2026-01-01T00:00:00Z",
  "limit": 50,
  "offset": 0
}
```

**List Leads with Intent Scores (Protected):**
```typescript
POST /intent-scorer/leads
Headers: {
  "Authorization": "Bearer <clerk-token>"
}
Body: {
  "min_score_7d": 10,
  "min_score_30d": 20,
  "activity_days": 30,
  "search": "acme",
  "limit": 50,
  "offset": 0,
  "sort_by": "score_7d",
  "sort_order": "desc"
}
```

**List Leads (Public - Testing Only):**
```typescript
POST /intent-scorer/leads/public
Body: {
  "limit": 50,
  "offset": 0
}
```

**Lead Trend (Sparkline):**
```typescript
POST /intent-scorer/lead-trend
{
  "lead_id": "<lead-id>",
  "days": 14
}
```

**Lead Top Signals:**
```typescript
POST /intent-scorer/lead-top-signals
{
  "lead_id": "<lead-id>",
  "limit": 10
}
```

**Seed Demo Data:**
```typescript
POST /intent-scorer/seed-demo
```

**Website Tracking (Anonymous-First):**
```powershell
$payload = @{
  event = "page_view"
  session_id = "11111111-1111-4111-8111-111111111111"
  anonymous_id = "22222222-2222-4222-8222-222222222222"
  url = "/"
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  metadata = @{ source = "powershell_test" }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post -Uri "https://do-intent.onrender.com/track" `
  -ContentType "application/json" -Body $payload
```

**Website Identify (Anonymous -> Identity):**
```powershell
$payload = @{
  anonymous_id = "22222222-2222-4222-8222-222222222222"
  identity = @{
    email = "user@example.com"
    name = "Jane Doe"
    source = "website"
  }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post -Uri "https://do-intent.onrender.com/api/v1/identify" `
  -ContentType "application/json" -Body $payload
```

**Website Ingest (Lead-Based):**
```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-ingest-api-key" = "your-api-key"
}
$payload = @{
  event_type = "page_view"
  event_source = "website"
  lead_id = "<lead-id>"
  url = "https://example.com/pricing"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://do-intent.onrender.com/api/v1/ingest" `
  -Headers $headers -Body $payload
```

## Environment Variables

- `ENABLE_DB`: gates `/track` and `/api/v1/track` persistence
- `DATABASE_URL` or `DATABASE_*`: Postgres connection config
- `INGEST_API_KEY`: required in production for `/marketing/ingest-intent-event` and `/api/v1/ingest` (`x-ingest-api-key`)
- `ALLOWED_INGEST_ORIGINS`: optional origin allowlist
- `DISABLE_AUTH_FOR_INTENT_LIST`: enables `/intent-scorer/leads/public`
- `CLERK_SECRET_KEY`: required for auth-protected endpoints

## Common Errors

### 401 Unauthorized
- Missing or invalid `Authorization` header for `/intent-scorer/leads`
- Missing or invalid `x-ingest-api-key` for `/marketing/ingest-intent-event` or `/api/v1/ingest`

### 404 Not Found
- Public endpoint (`/intent-scorer/leads/public`) disabled unless `DISABLE_AUTH_FOR_INTENT_LIST=true`

### 400 Invalid Argument
- Missing `lead_id` or `anonymous_id` on ingest requests
- Missing `url` or `path` for ingest requests

### DB Disabled
- `/track` returns `{ ok: true, stored: false, reason: "db_disabled" }` when `ENABLE_DB` is not `"true"`
- `/api/v1/ingest` returns `202` with `reason: "db_disabled"` if DB is disabled

## Key Design Decisions

1. **Deterministic & Explainable**: No LLM dependency in v1.
2. **Backward Compatible**: Existing marketing module continues to work.
3. **Flexible Rules**: Rules stored in database, editable via UI.
4. **Efficient Rollups**: Pre-computed 7d/30d aggregations avoid expensive queries.
5. **Anonymous-First Tracking**: Promotes identity only when email is known.

## Future Enhancements

- LLM-based scoring as "rules_v2" model
- A/B testing between rule versions
- Custom modifier conditions via UI
- Webhook notifications on high scores
- Export scored events to CSV/JSON

## Testing

1. Create test leads in Marketing module
2. Generate intent events via webhook or ingest endpoints
3. Check Events tab to see raw events
4. Check Scores tab to see computed scores with reasoning
5. Edit rules and recompute to verify changes
6. Monitor lead_intent_rollups for 7d/30d aggregations
