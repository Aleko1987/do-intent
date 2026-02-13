# Stage 1 Release Notes

Stage 1 MVP is now deployed and stable.

This release focuses on anonymous-first tracking reliability, identity merge, score quality, ABM account rollups, attribution consistency, and lead-magnet growth flow.

## Scope Delivered

### 1) Anonymous-first tracking reliability
- Added 30-minute inactivity-based `session_id` rotation in tracker.
- Added explicit `event_id` in `/track` payload and dedupe-safe persistence via `dedupe_key`.
- Added `page_class` in tracking metadata.
- Added click ID capture in tracker metadata: `gclid`, `fbclid`, `msclkid`.
- Added optional first-party cookie storage mode (`useCookies`) plus storage fallback.

### 2) Identity + score merge
- `/identify` merges anonymous history into identity scoring.
- Added explainability persistence (`top_events` + reasons) on identity score metadata.
- Documented canonical identity vs marketing lead mapping.

### 3) Scoring v1 upgrades
- Added time-decay on subject scores (half-life by event class).
- Added saturation/caps to prevent score inflation.
- Documented decay model and parameters in architecture docs.

### 4) Account rollup v1 (ABM)
- Added `accounts` and `account_members` schema (`014_create_accounts_rollup.up.sql`).
- Derives account from business email domain (excludes common free-email domains).
- Added account rollup logic:
  - `account_score = sum(top 3 person scores) + diversity bonus`
  - `active_people_14d`
- Added endpoints:
  - `POST /accounts/list`
  - `POST /accounts/get`

### 5) Marketing attribution capture
- Added click IDs support for lead-based ingest paths.
- Normalized attribution persistence in `intent_events.metadata` across ingest paths:
  - `url`, `path`, `referrer`
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
  - `gclid`, `fbclid`, `msclkid`
  - `dedupe_key`, `anonymous_id`

### 6) Lead magnet funnel (growth)
- Added CTA placement in top navigation.
- Added exit-intent prompt on high-intent pages (`/pricing`, `/intent-scorer`).
- Implemented lead magnet form capture via `/marketing/identify`.
- Added mini-report auto-delivery in-app + download.
- Added optional qualification fields + teardown call request flow with tracking.

### 7) Docs and ops
- Updated tracker documentation with session timeout, click IDs, and cookie mode.
- Added Stage 1 acceptance criteria document.
- Finalized Stage 1 implementation checklist as complete.

## Deployment Notes

- Frontend is served by backend at `/app`.
- Root `/` remains intentionally disabled.
- Health endpoint: `/healthz`.

Recommended post-deploy smoke checks:
- `GET /healthz` returns 200 JSON.
- `GET /app` returns 200 HTML.
- `GET /app/marketing` returns 200 HTML.
- Asset URLs referenced by `/app` return 200.

## Migration Notes

New migration included in this stage:
- `backend/db/migrations/014_create_accounts_rollup.up.sql`

Ensure migrations run in deployment before validating ABM endpoints.

## Validation Docs

- Acceptance criteria: `docs/STAGE1_ACCEPTANCE.md`
- Feature-by-feature test matrix: `docs/STAGE1_FEATURE_TEST_MATRIX.md`

## Follow-up (Post Stage 1)

- Add a compact release dashboard panel for account rollups and funnel conversion.
- Add automated integration checks for `/app` and top API flows in CI.
- Consider tracking teardown booking completion webhook for closed-loop funnel analytics.


