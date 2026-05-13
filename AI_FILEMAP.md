# AI File Map

## Repository Structure
| Path | Purpose |
|---|---|
| `backend/` | Encore.dev backend services, raw APIs, database helpers, migrations, tests, and generated Encore files. |
| `frontend/` | React/Vite frontend, generated Encore client, dashboard pages, tracking helpers, and UI components. |
| `companion/` | Electron desktop companion for hotkey screenshot capture, OCR, optional local LLM extraction, and intake upload. |
| `web/` | Legacy/minimal Express server wrapper for `/track` and `/ready`. |
| `docs/` | Architecture, runbooks, social contract, stage plans, tracker snippets, and recent progress docs. |
| `.github/` | GitHub workflows for Docker/image and migration automation. |
| `.encore/`, `backend/.encore/` | Encore local/generated runtime data. Treat as tool-managed. |
| `node_modules/`, `frontend/node_modules/`, `companion/node_modules/` | Installed dependencies. Do not inspect or edit for documentation unification. |

## Root Documentation
| File | Purpose |
|---|---|
| `AI_CONTEXT.md` | AI-readable product and maturity summary. |
| `AI_FILEMAP.md` | This repo map. |
| `AI_ARCHITECTURE.md` | AI-readable architecture overview. |
| `AI_DATABASE.md` | AI-readable database/schema overview. |
| `AI_API.md` | AI-readable API route overview. |
| `AI_KEEP_DELETE.md` | Keep/delete/technical debt guidance. |
| `AI_UNIFICATION_NOTES.md` | Notes for merging into a larger platform. |
| `DEVELOPMENT.md` | Local dev, env, ingest, auth, and smoke-test instructions. |
| `DEPLOY_RENDER_DOCKER.md` | Current Render/GHCR deployment guide. |
| `INTEGRATIONS.md` | Website tracking/ingest integration notes. |
| `TRACKING_AND_SCORING.md` | Tracking paths and scoring system summary. |
| `INTENT_SCORER_README.md` / `INTENT_SCORER_SUMMARY.md` | Intent scorer feature documentation. |

## Backend Folders
| Folder | Purpose |
|---|---|
| `backend/auth/` | Clerk auth handler and Encore gateway. |
| `backend/content/` | Authenticated content planning APIs and post logs. |
| `backend/db/` | Postgres connection, migration runner, boot migrations, SQL migrations. |
| `backend/health/` | Health endpoints. |
| `backend/intent_scorer/` | Anonymous tracking, identify, scoring engine, score/rule APIs, rollups, tests. |
| `backend/internal/` | Shared helpers for DB, CORS, env/secret resolution, owner user, correlation IDs, JSON types. |
| `backend/marketing/` | Leads, events, candidate signals, entity resolution, owner contacts, social inbox, scoring config, tests. |
| `backend/scripts/` | Build/deploy helper scripts. |
| `backend/frontend/dist/` | Built frontend served by Encore; generated. |
| `backend/encore.gen/` | Generated Encore clients/entrypoints; do not edit manually. |

## Frontend Folders
| Folder / File | Purpose |
|---|---|
| `frontend/App.tsx` | Router and shell under basename `/app`. |
| `frontend/main.tsx` | React bootstrap. |
| `frontend/client.ts` | Generated Encore client with auth injection marker; treat as generated/sensitive. |
| `frontend/pages/` | Product pages and dashboards: Marketing, IntentScorer, LeadIntent, Contact, Pricing, CaseStudy. |
| `frontend/components/intent/` | Intent scorer tabs, lead drawer, events/scores/rules views. |
| `frontend/components/marketing/` | Marketing pipeline, lead directory, candidate review, social inbox, owner contacts. |
| `frontend/components/ui/` | Shared UI primitives. |
| `frontend/lib/` | Website tracking helpers and backend client hooks. |
| `frontend/src/lib/` | Clerk auth helper and fetch interceptor. |
| `frontend/dist/` | Generated build output. |

## Companion Folders
| Folder / File | Purpose |
|---|---|
| `companion/src/main.ts` | Electron companion entrypoint. |
| `companion/src/config.ts` | Required and optional capture/OCR/LLM env configuration. |
| `companion/src/capture/` | Screen and region capture. |
| `companion/src/ocr/` | Tesseract OCR. |
| `companion/src/extraction/` | Optional local LLM extraction. |
| `companion/src/hotkeys/` | Global hotkey parsing. |
| `companion/src/intake/` | Upload client for DO-Intent capture intake. |
| `companion/src/queue/` | Retry queue for failed uploads. |
| `companion/dist/` | Generated companion build output. |

## Config / Deployment Files
| File | Purpose |
|---|---|
| `package.json` | Root Bun workspace and web wrapper scripts. |
| `backend/package.json` | Backend build, migration, and guard scripts. |
| `frontend/package.json` | Frontend Vite scripts and dependencies. |
| `companion/package.json` | Companion build/test/dev scripts. |
| `render.yaml` | Marked deprecated in file comments. |
| `encore.app` | Encore app marker. |
| `backend/infra-config.json` | Backend infra config; needs review before unification. |

## Files Not To Touch Casually
- `backend/db/migrations/`: migration history and repair scripts.
- `backend/encore.gen/` and `frontend/client.ts`: generated Encore output.
- `backend/auth/auth.ts`: Clerk auth and gateway behavior.
- `backend/marketing/social_inbox.ts` and `docs/SOCIAL_INBOX_CONTRACT.md`: cross-repo DO-Socials contract surface.
- `backend/internal/env_secrets.ts`: secret name resolution.
- `companion/src/config.ts`: local capture/LLM env contract.
- `eng.traineddata`: OCR model data.
- Lock files: `bun.lock`, `package-lock.json`, `companion/package-lock.json`.

## Open Questions / Needs Review
- NEEDS REVIEW: Decide whether `web/` remains useful or is only legacy Render fallback.
- NEEDS REVIEW: Decide whether `backend/frontend/dist`, `frontend/dist`, and `companion/dist` should be excluded from the future source repo.
- NEEDS REVIEW: Confirm whether root `.env` templates should be added; currently only frontend env files were found and may contain environment-specific values.
- UNKNOWN: Whether `backend/infra-config.json` is active in deployment.
