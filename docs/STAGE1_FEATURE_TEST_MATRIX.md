# Stage 1 Feature Test Matrix

Use this file as a practical QA checklist for all Stage 1 features.

Status legend:
- `PASS` = verified in deployed env
- `FAIL` = broken/regressed
- `N/A` = not applicable in current env

---

## A. Anonymous-first tracking reliability

### A1. `session_id` rotates after 30m inactivity
- **Precondition:** Tracker initialized.
- **Steps:**
  1. Capture `session_id` from outgoing `/track`.
  2. Backdate `do_intent_session_ts` by >30m (or wait).
  3. Trigger another tracked event.
- **Expected:** New `session_id` is sent.
- **Status:** ___

### A2. Explicit `event_id` dedupe
- **Steps:**
  1. Send two events with same `event_source` and `event_id`/`dedupe_key`.
  2. Query or inspect event list.
- **Expected:** Single `intent_events` row persisted.
- **Status:** ___

### A3. `page_class` metadata capture
- **Steps:** Trigger `page_view` on pricing/docs/home pages.
- **Expected:** `metadata.page_class` populated with route class.
- **Status:** ___

### A4. Click IDs captured (tracker path)
- **Steps:**
  1. Open page with `?gclid=...&fbclid=...&msclkid=...`.
  2. Trigger `page_view` and/or `click`.
- **Expected:** Click IDs exist in `metadata`.
- **Status:** ___

### A5. Cookie storage mode works
- **Steps:**
  1. Initialize tracker with `useCookies: true`.
  2. Trigger events.
- **Expected:** IDs persisted/read via first-party cookies; tracking still succeeds.
- **Status:** ___

---

## B. Identity + score merge

### B1. Anonymous -> identity promotion
- **Steps:**
  1. Send anonymous tracked events.
  2. Call `/identify` with same `anonymous_id` + email.
- **Expected:** Response contains merged identity score; events/sessions are linked.
- **Status:** ___

### B2. Explainability stored per identity
- **Steps:** After identify + scoring activity, inspect `intent_subject_scores.metadata`.
- **Expected:** `top_events` and reasons exist with update timestamp.
- **Status:** ___

### B3. Lead backfill on matching email
- **Steps:** Ensure lead exists with same email, then identify.
- **Expected:** Anonymous `intent_events` get `lead_id` backfilled where null.
- **Status:** ___

---

## C. Scoring v1 upgrades

### C1. Time-decay applied
- **Steps:** Create score, then replay event with old/new timestamps to compare.
- **Expected:** Older intervals reduce effective carried score before delta add.
- **Status:** ___

### C2. Saturation + cap
- **Steps:** Repeatedly fire high-value events.
- **Expected:** Score growth slows near cap and never exceeds configured max.
- **Status:** ___

---

## D. Account rollup v1 (ABM)

### D1. Account creation from business domain
- **Steps:** Identify with business email (non-free domain).
- **Expected:** `accounts` row exists for domain; `account_members` mapping created.
- **Status:** ___

### D2. Free-email exclusion
- **Steps:** Identify with `gmail.com`/`outlook.com`.
- **Expected:** No `accounts` row auto-created from free domain.
- **Status:** ___

### D3. Rollup computation
- **Steps:** Seed multiple identities/scores in same account.
- **Expected:** `account_score = top3 sum + diversity bonus`; `active_people_14d` correct.
- **Status:** ___

### D4. Account endpoints
- **Steps:**
  - `POST /accounts/list`
  - `POST /accounts/get`
- **Expected:** Valid summaries + top people payloads.
- **Status:** ___

---

## E. Marketing attribution capture

### E1. Click IDs in lead-based ingest
- **Endpoints:** `/marketing/ingest-intent-event`, `/marketing/leads/:id/events`, `/marketing/events`
- **Steps:** Send payloads with click IDs.
- **Expected:** Click IDs persisted in `intent_events.metadata`.
- **Status:** ___

### E2. Attribution metadata consistency
- **Steps:** Send events through each ingest path with overlapping metadata.
- **Expected:** `url/path/referrer/utm_*` + click IDs backfilled consistently without clobbering existing values.
- **Status:** ___

---

## F. Lead magnet funnel (growth)

### F1. CTA placement
- **Steps:** Load app top nav; visit pricing/docs-intent pages.
- **Expected:** Top-nav lead magnet CTA visible; exit-intent prompt appears on eligible routes.
- **Status:** ___

### F2. Lead magnet form capture
- **Steps:** Submit contact lead-magnet form.
- **Expected:** `/marketing/identify` succeeds; lead is stored/updated.
- **Status:** ___

### F3. Mini-report delivery
- **Steps:** Complete form submit.
- **Expected:** Mini report appears in UI and downloads correctly.
- **Status:** ___

### F4. Qualification + teardown flow
- **Steps:** Fill optional qualification, request teardown call.
- **Expected:** Qualification tracked; booking URL opens; CTA event tracked.
- **Status:** ___

---

## G. Documentation + ops

### G1. Tracker docs current
- **File:** `docs/WEBSITE_TRACKER.md`
- **Expected:** Includes session timeout, click IDs, cookie mode behavior.
- **Status:** ___

### G2. Stage acceptance doc present
- **File:** `docs/STAGE1_ACCEPTANCE.md`
- **Expected:** Contains pass/fail criteria for A-G and exit rule.
- **Status:** ___

---

## Platform smoke checks

### S1. Backend health
- `GET /healthz` -> 200 JSON
- **Status:** ___

### S2. SPA serving
- `GET /app` -> 200 HTML
- `GET /app/marketing` -> 200 HTML
- **Status:** ___

### S3. SPA assets
- JS/CSS URLs referenced by `/app` -> 200
- **Status:** ___

---

## Sign-off

- Tester: ____________________
- Environment: _______________
- Date: ______________________
- Stage 1 decision: `GO` / `NO-GO`


