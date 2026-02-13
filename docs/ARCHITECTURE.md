# DO-Intent — Architecture & Scoring System

## Purpose

DO-Intent is a real-time, deterministic intent scoring engine.
Its role is to capture first-party behavioral signals, calculate intent scores instantly,
and emit intent signals to downstream systems (DO-Socials, DO-Sales, notifications).

DO-Intent does NOT:
- Send messages
- Perform outreach
- Render dashboards
- Perform AI interpretation (yet)

It emits truth. Other systems act.

---

## Core Design Principles

1. Real-time scoring (recency bias matters)
2. Deterministic logic over AI (v1)
3. Anonymous-first, identity-later
4. Incremental scoring (no recomputation)
5. Event-driven, fire-and-forget
6. Platform-agnostic (website first, socials later)

---

## High-Level Flow

Website / Platform
  → /track (event)
    → persist event
    → calculate score delta
    → update intent_score
    → evaluate thresholds
    → emit intent_signal (internal)

Identity capture:
  → /identify
    → merge anonymous history
    → recompute final score once
    → re-evaluate thresholds

---

## Data Model (Conceptual)

### Sessions
Represents a browsing session (anonymous by default).

Key fields:
- session_id (uuid)
- anonymous_id (uuid)
- first_seen_at
- last_seen_at
- user_agent
- device
- country

---

### Events
Raw immutable interaction data.

Key fields:
- event_id (uuid)
- session_id
- anonymous_id
- identity_id (nullable)
- event_type
- event_value (optional numeric)
- url
- referrer
- timestamp
- metadata (jsonb)

Events are never updated or deleted.

---

### Identities
Represents a known person or entity.

Key fields:
- identity_id (uuid)
- email
- name (optional)
- first_identified_at
- last_seen_at
- source (website, socials, etc.)

---

## Canonical person (identity) vs marketing lead (pipeline record)

DO-Intent has **two “person-like” concepts** that serve different jobs:

- **`identities` (canonical person)**: the product’s global view of a human. It is created/updated via `/identify` and used for **identity-level scoring** (`intent_subject_scores.subject_type = 'identity'`).
- **`marketing_leads` (pipeline record)**: a CRM/workflow object used by the marketing UI. It has ownership (`owner_user_id`), stage, and rollups (e.g. `lead_intent_rollups`).

### How they map today (Stage 1)

- **Primary key for mapping is normalized email**.
- The database currently enforces **a unique lowercased email** in `marketing_leads` (`idx_marketing_leads_email`), so in practice this is **0-or-1 lead per email**.

When `/identify` is called with an email:

1. We upsert an `identity` for the email.
2. We merge anonymous score into the identity score.
3. If a `marketing_leads` row exists for that email, we **backfill `intent_events.lead_id`** for the matching `anonymous_id` (only where `lead_id` is null), then recompute lead rollups.

This keeps **identity scoring** and **lead rollups** aligned without requiring `identities` to “own” pipeline semantics.

### Future notes (multi-tenant)

If/when we need true multi-tenant semantics (multiple pipeline records per email across owners), we should revisit:

- Email uniqueness scope (global vs per `owner_user_id`)
- A first-class mapping table (e.g. `identity_leads(identity_id, lead_id, owner_user_id)`)

---

### Intent Scores
Rolling, incremental intent state.

Key fields:
- subject_type (anonymous | identity)
- subject_id
- total_score
- last_event_at
- last_threshold_emitted
- updated_at

---

## Website Event Taxonomy (v1)

Mandatory events:

- page_view
- time_on_page
- scroll_depth
- click
- form_start
- form_submit

Optional (future):
- video_play
- download
- pricing_view (derived)

---

## Scoring System (Initial Weights)

All scoring is incremental.

| Event | Condition | Score Delta |
|-----|---------|------------|
| page_view | any | +1 |
| time_on_page | > 30s | +2 |
| scroll_depth | > 60% | +2 |
| click | CTA / key link | +3 |
| pricing_view | derived from URL | +4 |
| form_start | any | +6 |
| form_submit | any | +10 |
| return_visit | new session within 30d | +5 |

Weights are configuration-driven, not hardcoded.

---

## Threshold Bands

| Score Range | State | Meaning |
|-----------|------|--------|
| 0–9 | Cold | Awareness only |
| 10–19 | Warm | Early interest |
| 20–29 | Hot | Sales-ready |
| 30+ | 🔥 Critical | Immediate outreach |

Thresholds are evaluated after every score update.

---

## Time-decay + caps (Scoring v1 upgrades)

To prevent score inflation and reflect recency bias, DO-Intent applies **exponential time decay** to `intent_subject_scores.total_score` whenever a new scored event arrives.

### Decay model

Given:
- $S$: previous total score
- $\Delta t$: seconds since `last_event_at`
- $h$: half-life in seconds (varies by event class)

We compute:

$$
S_{decayed} = S \cdot 0.5^{\Delta t / h}
$$

Then we add the new event’s score delta (with saturation near the cap) and clamp to a maximum.

### Event classes + half-life

- **browse**: 2 days
- **engagement**: 7 days
- **conversion**: 21 days

Classification heuristics (website events):
- `form_submit` → conversion
- `form_start`, `pricing_view`, pricing clicks → engagement
- everything else → browse
- `metadata.page_class` can bias classification (e.g. pricing/product → engagement; docs/blog → browse)

### Caps / saturation

- **Subject score cap**: 60 (hard clamp)
- **Saturation near cap** (applied on update):
  - at >= 60: delta becomes 0
  - at >= 48 (80%): delta scaled to 20%
  - at >= 36 (60%): delta scaled to 50%

## Threshold Emission Rules

- A threshold is emitted only once per band per subject
- Re-emission allowed if score decays and re-crosses (future)
- Emissions include context payload

Example emission payload:

{
  "identity_id": "uuid",
  "score": 32,
  "state": "critical",
  "source": "website",
  "last_event": "form_submit",
  "timestamp": 1700000000
}

---

## Identity Promotion Logic

1. Anonymous browsing accumulates score
2. Identity capture occurs (email / form)
3. /identify merges anonymous → identity
4. Anonymous score is transferred
5. Thresholds re-evaluated immediately
6. Intent signal may fire instantly

This enables sub-minute outreach.

---

## What Comes Next (Not in v1)

- Score decay over time
- Cross-platform weighting (socials)
- AI interpretation layer
- Confidence scoring
- Intent explanation summaries

---

## Project Status (Stage 1 MVP)

The phased roadmap and current gap analysis live here:
- `docs/INTENT_GROWTH_PLAN.md`
- `docs/STAGE1_MVP_GAP_ANALYSIS.md`

