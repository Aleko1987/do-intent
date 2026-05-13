# AI Architecture

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Encore.dev, TypeScript, raw Encore APIs, Node runtime |
| Database | Postgres through `pg` Pool |
| Auth | Clerk backend auth via Encore auth handler |
| Frontend | React 19, Vite, TypeScript, React Router |
| UI | Tailwind CSS 4, Radix primitives, lucide-react, local UI primitives |
| Desktop companion | Electron, TypeScript, screenshot-desktop, active-win, node-global-key-listener |
| OCR / Extraction | Tesseract.js, optional local LLM via Ollama-style endpoint |
| Deployment | Encore Docker image pushed to GHCR and deployed to Render; older `render.yaml` is deprecated |

## Runtime Architecture
- The primary backend is an Encore app in `backend/`.
- Public and protected APIs are declared with `api(...)` and `api.raw(...)`.
- Clerk authentication is wired through `backend/auth/auth.ts`; protected APIs use `auth: true`.
- The React frontend builds into `backend/frontend/dist` for serving through Encore routes under `/app`.
- The frontend also has standalone Vite development support in `frontend/`.
- The desktop companion is a separate Electron process that sends captured screenshots to backend intake.
- `web/server.ts` is a separate Express server path that appears legacy/minimal compared with the Encore backend.

## Main Data Flows
### Anonymous Website Tracking
1. Browser tracker sends `page_view`, `time_on_page`, `scroll_depth`, `click`, and form events to `/track` or `/api/v1/track`.
2. Backend writes `sessions` and `events` when `ENABLE_DB=true`.
3. Website scoring updates `intent_subject_scores` and may emit intent signals.
4. `/identify` or `/api/v1/identify` promotes anonymous activity to an identity and may backfill lead linkage.

### Lead-Based Ingest
1. Website/app calls `/marketing/identify` with email and anonymous context.
2. Backend upserts or finds `marketing_leads`.
3. Events go to `/marketing/ingest-intent-event` or `/api/v1/ingest`.
4. Events persist in `intent_events`, scoring runs, and lead rollups update.

### Candidate Signal Capture
1. Companion captures screen region/fullscreen through hotkeys.
2. OCR and optional local LLM extraction enrich the capture.
3. Companion posts to `/marketing/capture-intake` using a bearer capture token.
4. Candidate signals and evidence enter a human review queue.
5. A reviewer can create, merge, promote, or request reminders for candidate signals.

### Social Inbox
1. DO-Socials sends normalized social events to `/social-events/ingest`.
2. DO-Intent creates idempotent `inbox_tasks`.
3. Authenticated users review, approve, reject, or execute tasks.
4. Execution calls DO-Socials `/api/content-ops/social-execution/execute-task`.
5. Successful executions can create social activity events and scoring ledger entries.

## Key Services / Modules
| Module | Purpose |
|---|---|
| `backend/intent_scorer/track.ts` | Anonymous tracking endpoints and scoring behavior. |
| `backend/intent_scorer/identify.ts` | Identity promotion and anonymous-to-known merge flow. |
| `backend/intent_scorer/scoring.ts` / `engine.ts` | Deterministic scoring logic. |
| `backend/marketing/identify.ts` | Lead-based identification and upsert behavior. |
| `backend/marketing/ingest_intent_event.ts` | Lead-based event ingest and scoring. |
| `backend/marketing/capture_intake.ts` | Screenshot/candidate signal intake. |
| `backend/marketing/social_inbox.ts` | Social inbox ingestion, review, execution, and scoring bridge. |
| `backend/marketing/owner_contact_directory_service.ts` | Owner contact directory import/resolution support. |
| `backend/db/db.ts` | Postgres connection plus runtime schema safeguards. |
| `companion/src/*` | Capture, OCR, extraction, retry queue, and intake client. |

## External Integrations
| Integration | Purpose |
|---|---|
| Clerk | Authenticated user identity for protected backend/frontend flows. |
| Postgres / Render Postgres / Neon-compatible DB | Primary persistence. |
| DO-Socials | Social event producer and execution adapter. |
| Website tracker snippets | First-party web behavior capture. |
| Electron desktop APIs | Cross-application screenshot capture. |
| Tesseract OCR | Local text extraction from screenshots. |
| Optional local LLM endpoint | Local lead candidate extraction from OCR text. |
| GHCR / Render | Current Docker deployment path. |

## Auth Model
- Clerk-backed protected APIs use `auth: true`.
- Several ingestion endpoints are intentionally public but guarded by API keys or bearer tokens:
  - `/marketing/ingest-intent-event` and `/api/v1/ingest` use `x-ingest-api-key` in production.
  - `/marketing/identify` uses `x-do-intent-key`.
  - `/marketing/capture-intake` uses a capture intake bearer token.
  - `/social-events/ingest` uses `Authorization: Bearer ${DO_SOCIALS_INGEST_TOKEN}`.
- Some debug, health, tracker, and legacy/testing endpoints are public.

## Background Jobs / Queues / Webhooks
- No durable general job queue was found.
- Companion has a local retry queue for failed capture uploads.
- Backend has migration-on-start behavior when configured and runtime schema ensure logic.
- Social inbox execution is request-driven, not a background worker.
- Website tracking and social ingest are event-ingest endpoints rather than traditional webhooks, though `/marketing/events` accepts webhook-style lead events.

## Known Architectural Weaknesses
- Multiple event ingestion paths overlap and should be unified before rebuild.
- Some schema repair happens at runtime in `backend/db/db.ts` and `web/server.ts`.
- Migration set includes duplicate initial migrations and repair migrations.
- Frontend generated client and built assets are present in source, creating future maintenance ambiguity.
- `frontend/src/lib/setupAuth.ts` only injects auth for URLs containing `do-intent.onrender.com`.
- `web/server.ts` duplicates a small part of the tracking/database behavior outside Encore.
- Public/testing endpoints should be reviewed before any unified production API exposure.

## Open Questions / Needs Review
- NEEDS REVIEW: Decide whether the future rebuild uses Encore, a conventional Node API, or a shared platform backend.
- NEEDS REVIEW: Define one canonical event ingestion API with adapters for website, social, manual capture, and CRM/webhook sources.
- NEEDS REVIEW: Move runtime schema repair into migrations only.
- UNKNOWN: Whether all current public endpoints are intentionally exposed in production.
