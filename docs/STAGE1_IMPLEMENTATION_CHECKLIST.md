# Stage 1 MVP Implementation Checklist

Derived from `docs/INTENT_GROWTH_PLAN.md` and `docs/STAGE1_MVP_GAP_ANALYSIS.md`.

Status legend:
- [ ] Not started
- [~] In progress
- [x] Done

## A. Anonymous-first tracking reliability
- [x] Add 30-min inactivity timeout for `session_id` rotation in `doIntentTracker.ts`
- [x] Add explicit `event_id` to `/track` payloads and store as `dedupe_key`
- [x] Add `page_class` to `/track` metadata
- [x] Capture click IDs in tracker metadata (`gclid`, `fbclid`, `msclkid`)
- [x] Optional: support first-party cookie storage in addition to localStorage

## B. Identity + score merge
- [x] Anonymous → identity promotion works via `/identify`
- [x] Store top contributing events + reasons for explainability (per identity)
- [x] Document canonical person vs lead mapping (if needed beyond identities table)

## C. Scoring v1 upgrades
- [x] Add time-decay logic (half-life by event class)
- [x] Add saturation/caps to prevent score inflation
- [x] Document decay parameters and caps in `docs/ARCHITECTURE.md`

## D. Account rollup v1 (ABM)
- [ ] Create `accounts` table + `account_members` mapping
- [ ] Derive account from business email domain (exclude free email domains)
- [ ] Compute `account_score = sum(top 3 person scores) + diversity bonus`
- [ ] Add `active_people_14d` metric
- [ ] Expose account rollup endpoint(s)

## E. Marketing attribution capture
- [~] UTMs captured in `doIntent.ts` and `doIntentTracker.ts`
- [ ] Add click IDs to both lead-based ingest and anonymous tracking
- [ ] Persist attribution fields in `intent_events` metadata consistently

## F. Lead magnet funnel (growth)
- [ ] Add CTA placement (top nav + exit intent on pricing/docs)
- [ ] Implement lead magnet form capture → `/marketing/identify`
- [ ] Auto-deliver mini-report
- [ ] Optional: qualification + teardown call flow

## G. Documentation + ops
- [ ] Update `docs/WEBSITE_TRACKER.md` with session timeout + click IDs
- [ ] Add `docs/STAGE1_ACCEPTANCE.md` with test criteria

