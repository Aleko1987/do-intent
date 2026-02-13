# Stage 1 Acceptance Criteria

This document defines practical pass/fail checks for Stage 1 MVP.

## Environment Preconditions

- Backend deployed and healthy (`/healthz` returns 200 with `{"ok":true}`).
- `ENABLE_DB=true` in deployment environment.
- Latest migrations applied (including ABM migration `014_create_accounts_rollup.up.sql`).

## A. Anonymous-first tracking reliability

- **Track writes are accepted**
  - `POST /track` returns `{ ok: true }`.
  - Event appears in `intent_events` when DB is enabled.
- **Dedupe by explicit event ID**
  - Sending same `(event_source, dedupe_key)` twice does not create duplicate `intent_events`.
- **Metadata includes page class + click IDs**
  - For URLs with `gclid/fbclid/msclkid`, those keys are persisted in `intent_events.metadata`.
- **Session timeout rotation**
  - After >30 minutes inactivity, a new `session_id` is used by tracker.
- **Cookie mode works**
  - With `useCookies=true` (or storage blocked), tracker still sends stable `anonymous_id` and `session_id`.

## B. Identity + score merge

- **Anonymous to identity merge**
  - `/identify` upserts identity and links historical anonymous activity.
- **Explainability persisted**
  - `intent_subject_scores.metadata.top_events` is populated with scored contributing events + reasons.
- **Lead linkage**
  - If matching lead email exists, anonymous events are backfilled to `lead_id`.

## C. Scoring v1 upgrades

- **Decay behavior**
  - Older scores decay based on event class half-life (browse 2d, engagement 7d, conversion 21d).
- **Caps/saturation**
  - Subject score never exceeds cap (60).
  - Delta contribution is reduced near cap.

## D. Account rollup v1 (ABM)

- **Domain derivation**
  - Business-domain emails map identities to `accounts` + `account_members`.
  - Free-email domains are excluded from account creation.
- **Rollup fields**
  - `active_people_14d` reflects count of active identities in last 14 days.
  - `account_score` equals top-3 person scores plus diversity bonus.
- **Endpoints**
  - `POST /accounts/list` returns paginated account summaries.
  - `POST /accounts/get` returns account summary + top people.

## E. Marketing attribution capture

- **Lead-based ingest supports click IDs**
  - `gclid/fbclid/msclkid` accepted and persisted in metadata.
- **Metadata consistency**
  - Ingest paths consistently backfill `url/path/referrer/utm_*` and click IDs without overwriting existing values.

## SPA / Ops sanity checks

- `GET /app` returns 200 HTML.
- `GET /app/marketing` returns 200 HTML.
- Asset URLs referenced by `/app` return 200 (JS/CSS).

## Stage 1 Exit Rule

Stage 1 is accepted when:
- All checklist items in `docs/STAGE1_IMPLEMENTATION_CHECKLIST.md` are checked `[x]`, and
- The checks above pass in deployed environment.


