# Intent Scorer Service - Implementation Summary

## Overview

The Intent Scorer is a deterministic, rule-based scoring engine that processes intent events and computes scores with full explainability. It operates independently from the existing marketing module and provides a clean separation of concerns.

## Architecture

### Database Schema (Migration 004)

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

### Backend Service (`backend/intent_scorer/`)

**Core Files:**
- `encore.service.ts` - Service definition
- `types.ts` - TypeScript interfaces and types
- `engine.ts` - Deterministic scoring logic (rules v1)
- `auto_score.ts` - Auto-scoring on event insert

**API Endpoints:**
- `list_events.ts` - Filter and search events with scores
- `compute_score.ts` - Manually score a single event
- `recompute_scores.ts` - Batch recompute (e.g., last 30 days)
- `list_rules.ts` - Get all scoring rules
- `update_rule.ts` - Edit rule points, status, or description

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

### Frontend UI (`/intent-scorer` route)

**Three Tabs:**

1. **Events Tab**
   - Filter by source, event type, date range
   - Search in payload (JSON)
   - Displays event metadata and scoring reasons
   - Pagination support

2. **Scores Tab**
   - Shows scored events sorted by score (high to low)
   - Summary statistics (total, average, highest)
   - Manual "Recompute" button with configurable days
   - Full scoring breakdown per event

3. **Rules Tab**
   - Base Scores section (per event type)
   - Modifiers section (payload-based)
   - Inline editing of points and descriptions
   - Toggle rules on/off without deletion

### Auto-Scoring Integration

The intent scorer is automatically triggered when events are created via:
- `/marketing/leads/:id/events` (create_event.ts)
- `/marketing/events` (webhook_event.ts)

Flow:
1. Event created in `intent_events` table
2. `autoScoreEvent()` called immediately
3. Score computed using current active rules
4. Score stored in `intent_scores`
5. Lead rollup updated (7d/30d aggregations)
6. Existing marketing scoring continues (backward compatible)

## Usage

### Accessing the UI

Navigate to `/intent-scorer` in your browser to access the Intent Scorer dashboard.

### Manual Scoring

To manually score or rescore events:
1. Go to the Scores tab
2. Set the number of days to recompute (default: 30)
3. Click "Run Scoring"
4. All events in that window will be rescored with current rules

### Editing Rules

1. Go to the Rules tab
2. Click "Edit" on any base score or modifier
3. Change the points value or description
4. Click "Save"
5. Toggle rules on/off using the "Enabled/Disabled" button
6. Recompute scores to apply changes to historical events

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

**PowerShell Example (Protected Endpoint):**
```powershell
$BASE_URL = "https://do-intent.onrender.com"
$AUTH_TOKEN = "your-clerk-token"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $AUTH_TOKEN"
}

$body = @{
    limit = 50
    offset = 0
    sort_by = "score_7d"
    sort_order = "desc"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$BASE_URL/intent-scorer/leads" `
    -Headers $headers -Body $body
```

**Note:** Without the `Authorization` header, this endpoint returns `401 Unauthorized`.

**List Leads (Public - Testing Only):**
```typescript
POST /intent-scorer/leads/public
Body: {
  "limit": 50,
  "offset": 0
}
```

**PowerShell Example (Public Endpoint):**
```powershell
# This endpoint is only available when DISABLE_AUTH_FOR_INTENT_LIST=true
# When disabled, returns 404 with message explaining how to enable

$body = @{
    limit = 50
    offset = 0
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$BASE_URL/intent-scorer/leads/public" `
    -ContentType "application/json" -Body $body
```

**Environment Variable:** Set `DISABLE_AUTH_FOR_INTENT_LIST=true` to enable the public endpoint. This is for testing only and should not be enabled in production.

**Compute Score for Event:**
```typescript
POST /intent-scorer/compute
{
  "event_id": "uuid-here"
}
```

**Recompute Last 30 Days:**
```typescript
POST /intent-scorer/recompute
{
  "days": 30
}
```

**Update Rule:**
```typescript
POST /intent-scorer/rules/update
{
  "rule_key": "base_link_clicked",
  "points": 10,
  "is_active": true
}
```

**PowerShell Manual Test (Tracking):**
```powershell
$payload = @{
  event = "page_view"
  session_id = "11111111-1111-4111-8111-111111111111"
  anonymous_id = "22222222-2222-4222-8222-222222222222"
  url = "/"
  referrer = ""
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  value = 1
  metadata = @{ source = "powershell_test" }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post -Uri "https://do-intent-web.onrender.com/track" `
  -ContentType "application/json" -Body $payload
```

## Common Errors

### 401 Unauthorized

**Cause:** Missing or invalid `Authorization` header when calling protected endpoints like `/intent-scorer/leads`.

**Solution:** Include a valid Clerk token in the `Authorization` header:
```powershell
$headers = @{ "Authorization" = "Bearer your-clerk-token" }
```

### 404 Not Found

**Possible causes:**
- Wrong endpoint path
- Public endpoint (`/intent-scorer/leads/public`) is disabled (env var `DISABLE_AUTH_FOR_INTENT_LIST` is not set to `"true"`)

**Solution:** 
- Verify the endpoint path is correct
- For public endpoint: Set `DISABLE_AUTH_FOR_INTENT_LIST=true` in environment variables

### 502 Bad Gateway at Base URL

**Cause:** Previously, the root URL (`/`) sometimes returned 502 errors even when the service was healthy.

**Solution:** The root endpoint (`GET /`) now returns a JSON response `{ ok: true, service: "do-intent", ts: "<iso>" }`, resolving this issue. Use `/healthz` for Render health checks.

## Key Design Decisions

1. **Deterministic & Explainable**: No LLM dependency in v1. Every score has traceable reasoning.

2. **Backward Compatible**: Existing marketing module continues to work. Intent scorer runs in parallel.

3. **Flexible Rules**: Rules stored in database, editable via UI, versioned for future A/B testing.

4. **Efficient Rollups**: Pre-computed 7d/30d aggregations avoid expensive real-time queries.

5. **Minimal MVP**: Core functionality only. No auth complexity, no external dependencies.

## Future Enhancements

- LLM-based scoring as "rules_v2" model
- A/B testing between rule versions
- Custom modifier conditions via UI
- Webhook notifications on high scores
- Lead intent trend visualization
- Export scored events to CSV/JSON

## Database Queries

The scorer uses Encore.ts template literal syntax for static queries:
```typescript
const event = await db.queryRow<Event>`
  SELECT * FROM intent_events WHERE id = ${eventId}
`;
```

And raw query methods for dynamic SQL:
```typescript
const events = await db.rawQueryAll<ScoredEvent>(dataQuery, ...params);
```

## No Environment Variables Required

The Intent Scorer uses the same Neon Postgres database as the rest of the application. No additional configuration is needed.

## Testing

1. Create test leads in Marketing module
2. Generate intent events via webhook or UI
3. Check Events tab to see raw events
4. Check Scores tab to see computed scores with reasoning
5. Edit rules and recompute to verify changes
6. Monitor lead_intent_rollups for 7d/30d aggregations

---

**Status**: ✅ MVP Complete & Ready for Use

All todos completed:
- ✅ Migration created (intent_scores, lead_intent_rollups, intent_rules)
- ✅ Service and types defined
- ✅ Scoring engine implemented (rules v1)
- ✅ API endpoints created (list, compute, recompute, rules CRUD)
- ✅ Frontend UI with 3 tabs (Events, Scores, Rules)
- ✅ Auto-scoring on event insert
- ✅ Lead rollup calculations (7d/30d)
