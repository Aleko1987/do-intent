# Tracking Methods and Scoring System

## Tracking Methods

### 1. Anonymous-First Website Tracking (Intent Scorer)
Endpoints:
- `POST /track` (and `POST /api/v1/track`)
- `POST /identify` (and `POST /api/v1/identify`)

Flow:
1. The website tracker sends anonymous events to `/track` with:
   - `event`, `session_id`, `anonymous_id`, `url`, `timestamp`, optional `value`, `metadata`
2. The backend stores raw website sessions/events and (optionally) derives intent events:
   - `pricing_view` is derived from `page_view` or `click` when the URL includes `/pricing`
   - `return_visit` is derived for repeat sessions (deduped)
3. When an email is captured, `/identify` promotes anonymous history to a known identity and merges scores.

Persistence:
- `/track` persistence is gated by `ENABLE_DB=true`

### 2. Lead-Based Website Ingest (Marketing Service)
Endpoints:
- `POST /marketing/identify` (lead creation, uses `x-do-intent-key`)
- `POST /marketing/ingest-intent-event` (lead events, uses `x-ingest-api-key` in prod)
- `POST /api/v1/ingest` (same as above)

Flow:
1. Call `/marketing/identify` with `anonymous_id` + `email` to get a `lead_id`
2. Send lead-based events to `/marketing/ingest-intent-event` or `/api/v1/ingest`
3. Events are stored in `intent_events` and auto-scored

### 3. Webhook Event Ingest (Marketing Service)
Endpoint:
- `POST /marketing/events`

Flow:
1. External systems post events using `leadLookup` (email/phone) and metadata
2. Events are upserted with optional `dedupe_key`
3. Events are auto-scored and lead rollups are updated

## Scoring System

### A. Intent Scorer Rules (Deterministic, Explainable)
Used by:
- `/marketing/events`
- `/marketing/ingest-intent-event` and `/api/v1/ingest`
- Intent Scorer UI (Events/Scores/Rules)

Core tables:
- `intent_rules` (rule config)
- `intent_scores` (score + reasons)
- `lead_intent_rollups` (7d/30d rollups)

Rules (Rules V1):
- Base scores by event type:
  - `post_published`: +1
  - `link_clicked`: +5
  - `inbound_message`: +8
  - `quote_requested`: +15
  - `meeting_booked`: +20
  - `purchase_made`: +50
- Modifiers:
  - UTM medium = social: +1
  - Reach >= 5000: +2
  - Clicks in payload: +min(clicks, 20)
- Confidence:
  - CRM/Website source: 0.85
  - Content Ops source: 0.7
  - Missing fields or other sources: 0.55

Output:
- Scores include a human-readable `reasons[]` array for explainability.

### B. Website Tracking Scoring (Anonymous Incremental Scoring)
Used by:
- `/track` events and derived events

Event score deltas (from the website tracking rules):
- `page_view`: +1
  - Bonus: +4 if URL contains `/pricing`
- `time_on_page`: +2 when value > 30 seconds
- `scroll_depth`: +2 when value > 60 (0-100)
- `click`: +3
  - Bonus: +4 if URL contains `/pricing`
- `form_start`: +6
- `form_submit`: +10

Threshold bands:
- `cold`: 0-9
- `warm`: 10-19
- `hot`: 20-29
- `critical`: 30+

Promotion:
- When `/identify` is called, anonymous scores are merged into the identity score.

## Quick Reference

- Anonymous tracking: `/track` + `/identify`
- Lead-based ingest: `/marketing/identify` + `/marketing/ingest-intent-event`
- Webhook ingest: `/marketing/events`
- Intent scoring rules: `intent_rules` + `intent_scores` + `lead_intent_rollups`
- Website tracking scoring: `intent_subject_scores` with threshold bands

