# Stage 1 MVP Gap Analysis (Current Infra vs Plan)

This document compares current implementation against the Stage 1 scope in `docs/INTENT_GROWTH_PLAN.md`.

## Summary

Status legend:
- **Done**: Implemented and used in production code
- **Partial**: Implemented but missing key requirements
- **Not yet**: Not implemented

## Stage 1 outcomes

| Stage 1 Outcome | Status | Notes |
| --- | --- | --- |
| Anonymous-first tracking runs reliably across sessions | **Partial** | Anonymous ID stored in localStorage; session ID in sessionStorage, but no 30-min inactivity timeout. |
| /identify promotes anonymous → lead/person and merges history + score | **Done** | `/identify` merges anonymous history into identities and updates scores. |
| Rule scoring works with decay + saturation | **Not yet** | Current rules have no decay or saturation; scores are incremental only. |
| Marketing attribution captured (UTMs + click IDs) | **Partial** | UTMs captured; click IDs (gclid/fbclid) not explicitly captured. |
| Basic account rollup works via email domain | **Not yet** | No account-level entity/rollup implemented. |
| Lead magnet funnel is live | **Not yet** | No funnel flow or CTA mechanics implemented in code. |

## Stage 1 technical scope

### 1) Anonymous-first web tracking
Current:
- `/track` supports anonymous tracking with `anonymous_id` and `session_id`
- `doIntentTracker.ts` creates both IDs and auto-tracks page view/scroll depth/time on page/CTA clicks

Gaps:
- No inactivity-based session rotation (30-min timeout)
- No explicit `event_id` ingestion or dedupe field in `/track`
- Missing required fields: `page_class`, `gclid`, `fbclid`
- No first-party cookie option (localStorage + sessionStorage only)

### 2) Identify + score merge
Current:
- `/identify` promotes anonymous sessions to an identity and merges intent scores
- Backfills `events.identity_id` and updates `intent_subject_scores`
- Updates `intent_events.lead_id` when email matches a lead

Gaps:
- No explicit `canonical_person_id` mapping table (uses identities table directly)
- No explicit "top contributing events + reasons" output stored for explainability

### 3) Scoring v1 upgrades
Current:
- Intent scorer rules for lead-based events (intent_rules)
- Anonymous tracking scoring for website events (incremental deltas)

Gaps:
- No time-decay or half-life logic
- No saturation/caps (per-event or per-window)

### 4) Account rollup v1
Current:
- Lead rollups exist (`lead_intent_rollups`)

Gaps:
- No account entity derived from email domain
- No rollup logic across multiple people for account intent
- No diversity bonus or active_people_14d metric

### 5) Lead magnet funnel (growth)
Current:
- Marketing pages exist (`/contact`, `/pricing`, `/case-study/:slug`)
- Contact form triggers identify + form_submit tracking

Gaps:
- No CTA wiring for the lead magnet offer
- No mini-report delivery flow
- No qualification or booking CTA

## Suggested MVP work items (Stage 1)

1. **Session timeout**: Rotate `session_id` after 30 minutes of inactivity.
2. **Event dedupe**: Accept `event_id` in `/track`, store as `dedupe_key`.
3. **Attribution**: Capture `gclid`, `fbclid` (and optional click IDs) in tracker metadata.
4. **Decay + saturation**: Add half-life decay and saturation caps in scoring.
5. **Account rollups**: Create `accounts` table and rollups by email domain.
6. **Lead magnet flow**: Add CTA + form + delivery workflow.

