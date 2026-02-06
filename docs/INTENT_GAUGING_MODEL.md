# Intent Gauging Model

This document defines how DO-Intent gauges intent from website and social media signals, maps them into marketing stages, and decides when to hand off to sales CRM. It is aligned with the deterministic, rules-driven model and current schema described in `AI_CONTEXT.md` and `docs/ARCHITECTURE.md`.

## Goals
- Capture first‑party intent signals (website + social) in a consistent event model.
- Score signals deterministically via configurable rules.
- Roll up intent over 7/30 days to drive pipeline movement.
- Emit threshold signals once per band for downstream systems (CRM, sales ops).

## Event Taxonomy

### Website Signals (v1)
Mandatory events:
- `page_view`
- `time_on_page` (value in seconds)
- `scroll_depth` (value in %)
- `click` (CTA/key link)
- `form_start`
- `form_submit`

Derived/behavioral:
- `pricing_view` (derived from URL)
- `return_visit` (new session within 30 days)

### Social Signals (v1)
Primary:
- `post_impression`
- `post_engaged` (any reaction/like)
- `post_click` (link click)
- `comment`
- `share`
- `dm_inbound`
- `profile_visit`
- `follow`

Secondary:
- `meeting_requested`
- `calendar_booked`

Social events are expected to arrive through ingestion endpoints and should be normalized into `intent_events` with `event_source = "social"` (or a more specific source like `linkedin`, `x`, `meta`).

## Event Shape (Normalized)
Required fields for all events:
- `event_type` (string)
- `event_source` (string)
- `occurred_at` (timestamp)
- `metadata` (json object; include source-specific context)

Optional:
- `event_value` (numeric; e.g., seconds for time_on_page, % for scroll_depth)
- `lead_id` (nullable for anonymous-first flows)
- `anonymous_id` (string for anonymous web sessions)
- `dedupe_key` (string for idempotency)

### Dedupe Strategy
Use `dedupe_key` when the upstream platform provides a stable event id.
Suggested format:
`<source>:<event_type>:<external_id>`

Examples:
- `linkedin:post_click:lk_983247`
- `website:return_visit:<session_id>`

## Scoring Model

### Base Scores (Website, v1)
From `docs/ARCHITECTURE.md`:
- `page_view` → +1
- `time_on_page` (>30s) → +2
- `scroll_depth` (>60%) → +2
- `click` (CTA/key link) → +3
- `pricing_view` (derived) → +4
- `form_start` → +6
- `form_submit` → +10
- `return_visit` (within 30d) → +5

### Base Scores (Social, v1 Suggested)
Suggested initial weights (adjust via `intent_rules`):
- `post_impression` → +0.5
- `post_engaged` → +1
- `post_click` → +4
- `comment` → +5
- `share` → +6
- `dm_inbound` → +8
- `profile_visit` → +3
- `follow` → +3
- `meeting_requested` → +12
- `calendar_booked` → +20

### Modifiers (All Sources)
Modifiers are rule-driven, not hardcoded. Examples:
- High-value URL paths (pricing, contact, demo) → +3 to +6
- Campaign intent tags in metadata (e.g., `utm_campaign=high_intent`) → +2
- Seniority/role match in metadata (e.g., `title=CRO`) → +5
- Multi-touch escalation (3+ high-intent events in 7 days) → +3

### Confidence
Confidence is derived from:
- Signal clarity (e.g., `form_submit` > `page_view`)
- Source trust (website + CRM > social impressions)
- Field completeness (event_type, source, and metadata richness)

## Rollups & Recency

Use rollups for prioritization:
- `score_7d`: short-term intent spike
- `score_30d`: sustained interest

Recommended operational interpretation:
- Rising `score_7d` with steady `score_30d` → active buying research
- Flat `score_7d` with high `score_30d` → monitor, nurture

## Threshold Bands & Signals

Thresholds (from `docs/ARCHITECTURE.md`):
- 0–9 → Cold
- 10–19 → Warm
- 20–29 → Hot
- 30+ → Critical

Emissions:
- Emit once per band per subject (anonymous or identity).
- Re-emit only if decay is implemented and a band is re-crossed.

## Pipeline Mapping

Mapping intent bands into marketing stages (current schema: `M1`–`M5`):
- Cold → M1 (Awareness)
- Warm → M2 (Engaged)
- Hot → M4 (Sales-ready)
- Critical → M5 (Immediate outreach)

Optional intermediate:
- Warm with strong social + weak site → M3 (Nurture)

## CRM Handoff Criteria

Move to sales CRM when:
- `score_7d` ≥ 20 **or** `band` = Hot/Critical, **and**
- Lead is identified (email or CRM identity exists), **and**
- At least one high-intent event in last 14 days (form_submit, calendar_booked, dm_inbound, pricing_view + click).

## Cross-System Integration Flow

1) Website tracker sends `/track` events (anonymous-first).
2) `/identify` merges anonymous → identity after email capture.
3) Social ingestion posts into `intent_events` with `event_source = social`.
4) Scoring engine computes `intent_scores` per event.
5) Rollups update `lead_intent_rollups` (7d/30d).
6) Thresholds emit `intent_signals` for downstream systems.
7) CRM sync or sales ops acts on emitted signal.

## Example Payloads

### Website `/track`
```json
{
  "event": "page_view",
  "session_id": "uuid",
  "anonymous_id": "uuid",
  "url": "/pricing",
  "timestamp": "2026-02-06T12:00:00.000Z",
  "metadata": {
    "utm_source": "google",
    "utm_campaign": "pricing_high_intent"
  }
}
```

### Social Ingest (`intent_events`)
```json
{
  "event_type": "comment",
  "event_source": "linkedin",
  "occurred_at": "2026-02-06T12:00:00.000Z",
  "metadata": {
    "post_id": "lk_123",
    "author_handle": "@prospect",
    "comment_text": "How do we integrate this with Salesforce?"
  }
}
```

## Operational Checklist

- Confirm all events include `event_type`, `event_source`, `occurred_at`.
- Use `dedupe_key` when events are retried by ingestion pipelines.
- Keep `intent_rules` as the single source of truth for weights.
- Review rollups weekly to calibrate thresholds.


