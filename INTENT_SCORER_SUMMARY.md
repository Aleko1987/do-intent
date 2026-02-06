# Intent Scorer - Implementation Summary

## Completed Features

### 1. Backend Endpoints (Intent Scorer Service)

#### Scoring + Rules
- **`/intent-scorer/events`** - List events with scores and reasons
- **`/intent-scorer/compute`** - Manually score a single event
- **`/intent-scorer/recompute`** - Batch recompute scores
- **`/intent-scorer/rules`** - List scoring rules
- **`/intent-scorer/rules/update`** - Update a rule

#### Lead Insights
- **`/intent-scorer/leads`** - Lead list with rollups (Clerk auth required)
- **`/intent-scorer/leads/public`** - Public lead list (requires `DISABLE_AUTH_FOR_INTENT_LIST=true`)
- **`/intent-scorer/lead-rollups`** - Lead rollups with top signal
- **`/intent-scorer/lead-trend`** - Daily score buckets for sparkline charts
- **`/intent-scorer/lead-top-signals`** - Top scoring events (last 30 days)
- **`/intent-scorer/seed-demo`** - Seed demo leads/events

#### Website Tracking (Anonymous-First)
- **`/track`** and **`/api/v1/track`** - Raw website tracking (DB gated)
- **`/identify`** and **`/api/v1/identify`** - Promote anonymous activity to identity

#### Health Checks
- **`/health`**, **`/ready`**, **`/api/v1/ready`**
- **`/intent-scorer/ping`**
- **`/healthz`**, **`/health/version`**, **`/`**

### 2. Idempotency & Data Quality

#### Database Migration (`005_add_dedupe_key.up.sql`):
- Added `dedupe_key` column to `intent_events`
- Unique index on `(event_source, dedupe_key)` where not null

#### Webhook Improvements:
- Accepts optional `dedupe_key` in webhook requests
- Handles duplicate events gracefully (upsert logic)
- Always returns 200 for duplicate events
- Event type validation with enum enforcement
- Unknown types mapped to `'other'`
- Metadata normalization:
  - `utm_medium` lowercased
  - `reach` and `clicks` coerced to numbers

### 3. Lead Intent Dashboard UI

#### `/lead-intent` Route
- Table view of all leads with intent rollups
- Columns:
  - Lead name/company
  - Last intent date
  - 7-day score
  - 30-day score
  - Top signal (highest scoring event type in 30d)
  - Hotness badge (Cold <10, Warm 10-24, Hot 25-49, On Fire 50+)
- Search functionality
- Clickable rows open detail drawer

#### Intent Scorer UI
- `/intent-scorer` now includes a **Leads** tab in addition to Events/Scores/Rules

#### Lead Detail Drawer:
- Score summary cards (7d, 30d, last intent)
- **Sparkline chart** - 14-day daily score trend
- **Top 10 events** - Last 30 days sorted by score
  - Shows event type, source, date, score, reasons
- "Create Next Step" button (placeholder, currently disabled)

### 4. Scoring Engine Improvements
- Handles missing payload fields safely
- `utm_medium`, `reach`, `clicks` normalized and safely coerced
- No exceptions thrown for missing data

### 5. Website Tracking Enhancements
- `/track` stores sessions + raw events and derives pricing/return-visit signals
- Identity promotion merges anonymous scores into known identities

## File Changes

### Backend:
- `backend/intent_scorer/track.ts` (new - website tracking)
- `backend/intent_scorer/identify.ts` (new - identity promotion)
- `backend/intent_scorer/health.ts` (new - /health, /ready)
- `backend/intent_scorer/ping.ts` (new - /intent-scorer/ping)
- `backend/intent_scorer/list_leads_intent.ts` (new - /intent-scorer/leads)
- `backend/intent_scorer/list_lead_rollups.ts` (new)
- `backend/intent_scorer/get_lead_trend.ts` (new)
- `backend/intent_scorer/get_lead_top_signals.ts` (new)
- `backend/intent_scorer/seed_demo.ts` (new)
- `backend/marketing/ingest_intent_event.ts` (updated - ingest v1 + auth)
- `backend/marketing/webhook_event.ts` (updated - dedupe + normalization)

### Frontend:
- `frontend/pages/LeadIntent.tsx` (new)
- `frontend/components/intent/LeadIntentDrawer.tsx` (new)
- `frontend/components/intent/LeadsTab.tsx` (new)
- `frontend/pages/IntentScorer.tsx` (updated - Leads tab)

## Usage

### Seeding Demo Data
```bash
curl -X POST https://do-intent.onrender.com/intent-scorer/seed-demo
```

### Viewing Dashboard
- `/lead-intent`
- `/intent-scorer` (Leads tab)

### Webhook Integration (Idempotent)
```bash
curl -X POST https://do-intent.onrender.com/marketing/events \
  -H "Content-Type: application/json" \
  -d '{
    "leadLookup": {"email": "test@example.com"},
    "event_type": "link_clicked",
    "event_source": "lovable",
    "dedupe_key": "unique-event-id-123",
    "metadata": {
      "utm_medium": "social",
      "clicks": 5
    }
  }'
```

### Website Tracking (Anonymous-First)
```bash
curl -X POST https://do-intent.onrender.com/track \
  -H "Content-Type: application/json" \
  -d '{
    "event": "page_view",
    "session_id": "11111111-1111-4111-8111-111111111111",
    "anonymous_id": "22222222-2222-4222-8222-222222222222",
    "url": "/pricing",
    "timestamp": "2026-01-01T00:00:00.000Z",
    "metadata": { "source": "curl" }
  }'
```

## Next Steps / Future Enhancements
- Implement "Create Next Step" action (requires todos table or similar)
- Add real-time webhook ingestion from Lovable
- Add filters to Lead Intent dashboard (stage, score threshold)
- Export lead list to CSV
- Add lead assignment/routing based on intent score
