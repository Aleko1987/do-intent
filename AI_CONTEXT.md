# AI Context

## Software Summary
- **Name:** DO-Intent.
- **Type:** Intent tracking, lead intelligence, and social inbox orchestration system.
- **Primary purpose:** Capture first-party and social intent signals, score them deterministically, attach them to leads/accounts, and route actionable tasks for review or execution.
- **Current shape:** Encore.dev TypeScript backend, React/Vite frontend served under `/app`, Electron-based desktop companion for screenshot intake, and a small legacy Express web server wrapper.
- **Main users:** Marketers, sales operators, and founders who need to identify high-intent leads and review social/contact signals before acting.

## Business Purpose
- Turn website behavior, lead events, social inbox activity, and screenshot/manual capture into sales-usable intent data.
- Provide explainable scoring and review queues instead of opaque AI-only classification.
- Act as the intent layer in a larger system that may include DO-Socials, DO-Sales, content systems, notifications, and CRM workflows.

## Current Product Areas
| Area | Status | Notes |
|---|---:|---|
| Anonymous website tracking | Implemented | `/track`, `/api/v1/track`, sessions/events, anonymous scoring, identify promotion. |
| Lead-based ingest | Implemented | `/marketing/identify`, `/marketing/ingest-intent-event`, `/api/v1/ingest`. |
| Deterministic scoring | Implemented | Intent rules, scores, rollups, scoring config, IP pre-identify scoring. |
| Marketing lead pipeline | Implemented | Lead CRUD, events, stages, auto-push hooks, account rollups. |
| Candidate signal review | Implemented | Capture intake, evidence, reviews, reminders, promotion/merge/create-lead flows. |
| Owner contact directory | Implemented | Import, list, repair, platform/source scoping. |
| Social inbox contract | Implemented | Ingest social events from DO-Socials and execute approved tasks through DO-Socials. |
| Frontend dashboard | Implemented | Marketing, intent scorer, lead intent, contact/pricing/case-study pages. |
| Desktop companion | Implemented/experimental | Windows-first hotkey screenshot capture, OCR, optional local LLM extraction, retry queue. |
| Auth | Partial | Clerk auth exists for protected Encore APIs; several public/service endpoints remain. |

## Current Maturity / Status
- This repo is a working prototype-to-early-product system with many production-oriented pieces.
- The domain model is rich and useful, but implementation is transitional:
  - Multiple ingestion paths exist.
  - SQL migrations include repairs and duplicated initial migrations.
  - Runtime schema repair exists in DB startup paths.
  - Generated/build folders are present in the repo.
  - Frontend auth injection has hard-coded production URL behavior.
- Existing docs are substantial but spread across root docs and `docs/`.

## How It Fits A Future Unified Platform
- Best role: the **Intent Intelligence / Signal Review / Social Inbox module**.
- Strong candidates to preserve:
  - Event capture and normalized intent event model.
  - Lead/entity resolution logic.
  - Deterministic scoring rules and explainability.
  - Candidate signal review pipeline.
  - Owner contact directory.
  - Social inbox task model and DO-Socials contract.
  - Desktop capture companion concepts.
- Likely shared platform dependencies:
  - Global users/workspaces/organizations.
  - Shared lead/contact/account entities.
  - Shared event/audit ledger.
  - Shared auth and API gateway.
  - Shared social execution and notification services.

## Open Questions / Needs Review
- NEEDS REVIEW: Decide which ingestion path becomes canonical in the rebuild: anonymous-first, lead-based, social inbox, or a unified event API with adapters.
- NEEDS REVIEW: Decide whether DO-Intent owns leads/accounts globally or consumes shared CRM entities.
- NEEDS REVIEW: Clarify which generated/build folders should be excluded from future source history.
- UNKNOWN: Current production data shape and which migrations have been applied.
