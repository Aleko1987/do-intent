# Intent Scorer - Implementation Summary

## Completed Features

### 1. Backend Endpoints (Intent Scorer Service)

#### New API Endpoints:
- **`/intent-scorer/lead-rollups`** - List leads with intent rollups
  - Supports search (company name, contact name, email)
  - Includes pagination (limit, offset)
  - Returns lead info + 7d/30d scores + top signal
  
- **`/intent-scorer/lead-trend`** - Get daily score trend for a lead
  - Returns daily buckets of total score
  - Default 14 days, configurable
  - Used for sparkline charts
  
- **`/intent-scorer/lead-top-signals`** - Get top scoring events for a lead
  - Last 30 days
  - Sorted by score descending
  - Returns event details + score + reasons
  
- **`/intent-scorer/seed-demo`** - Seed demo data
  - Creates 3 sample leads
  - Generates 12+ events across 14 days
  - Auto-scores all events
  - Recomputes rollups

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

#### New Route: `/lead-intent`
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

## File Changes

### Backend:
- `backend/db/migrations/005_add_dedupe_key.up.sql` (new)
- `backend/intent_scorer/types.ts` (updated - new types)
- `backend/intent_scorer/list_lead_rollups.ts` (new)
- `backend/intent_scorer/get_lead_trend.ts` (new)
- `backend/intent_scorer/get_lead_top_signals.ts` (new)
- `backend/intent_scorer/seed_demo.ts` (new)
- `backend/intent_scorer/engine.ts` (updated - safer field handling)
- `backend/marketing/webhook_event.ts` (updated - dedupe + normalization)

### Frontend:
- `frontend/pages/LeadIntent.tsx` (new)
- `frontend/components/intent/LeadIntentDrawer.tsx` (new)
- `frontend/App.tsx` (updated - added route)

## Usage

### Seeding Demo Data
```bash
curl -X POST https://sales-crm-marketing-module-d5bc97s82vjumvbfskm0.api.lp.dev/intent-scorer/seed-demo
```

### Viewing Dashboard
Navigate to: `/lead-intent`

### Webhook Integration (Idempotent)
```bash
curl -X POST https://sales-crm-marketing-module-d5bc97s82vjumvbfskm0.api.lp.dev/marketing/events \
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

## Next Steps / Future Enhancements
- Implement "Create Next Step" action (requires todos table or similar)
- Add real-time webhook ingestion from Lovable
- Add filters to Lead Intent dashboard (stage, score threshold)
- Export lead list to CSV
- Add lead assignment/routing based on intent score
