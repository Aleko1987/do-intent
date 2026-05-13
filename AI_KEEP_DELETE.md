# AI Keep / Delete

## Valuable Parts To Keep
- Domain concepts:
  - Anonymous sessions and website events.
  - Identities and lead promotion.
  - Marketing leads and lead intent rollups.
  - Normalized intent events and deterministic scoring.
  - Candidate signal review pipeline.
  - Owner contact directory.
  - Social inbox tasks, watchlists, risk controls, and execution attempts.
- Cross-repo social contract in `docs/SOCIAL_INBOX_CONTRACT.md` and `backend/marketing/social_inbox.ts`.
- Tests covering scoring, tracking, owner resolution, capture intake, entity resolution, identify merge/carry-forward, and social inbox helpers.
- Companion capture ideas: global hotkeys, OCR, optional LLM extraction, retry queue, strict human review gate.
- Migration history as forensic evidence of schema evolution.
- Root and `docs/` markdown as source material for unified blueprint extraction.

## Fragile Parts To Be Careful With
- Auth and secret resolution:
  - `backend/auth/auth.ts`
  - `backend/internal/env_secrets.ts`
  - frontend auth interceptor behavior
- Social inbox execution path, because it calls DO-Socials and may apply score ledger entries.
- Candidate signal promotion/merge flows, because they affect lead data.
- Runtime schema repair code, because it may hide missing migrations.
- `frontend/client.ts`, `backend/encore.gen/`, and built frontend assets are generated.
- OCR trained data file `eng.traineddata` is large but required for local OCR workflows.

## Dead / Duplicated / Transitional Code
| Item | Status | Notes |
|---|---|---|
| `web/server.ts` | Likely legacy | Duplicates small tracking/DB behavior outside Encore. |
| `render.yaml` | Deprecated | File comments say Docker/GHCR Render deploy replaced it. |
| `backend/frontend/dist`, `frontend/dist`, `companion/dist` | Generated | Useful for deployment/history but should not guide rebuild architecture. |
| `backend/encore.gen/` | Generated | Do not manually preserve in a clean rebuild. |
| `frontend/client.ts` | Generated with local auth modifications | Rebuild should generate client or use explicit API SDK. |
| `1_init.up.sql` / `1_init.down.sql` | Duplicative | Coexists with numbered migrations; needs review. |
| Runtime schema repair | Transitional | Move to migrations only. |
| Multiple ingest routes | Redundant | Preserve behavior but unify contract. |

## Technical Debt
- No single canonical event model; `events` and `intent_events` overlap.
- No single canonical score model; several score tables and cached score fields coexist.
- Lead/person/account boundaries are unclear.
- Some APIs are public or testing-only and need production hardening.
- Frontend auth injection is URL-specific to production Render domain.
- Generated and dependency/build artifacts appear in source directories.
- Package management is mixed: root has `bun.lock` and `package-lock.json`, and companion has its own lock.
- Migration history includes repair migrations and runtime repair fallback, indicating deployment/schema drift.

## Things To Remove Later
- Remove `web/` if Encore remains the backend.
- Remove generated build outputs from the rebuilt source repo unless a deployment process explicitly requires them.
- Remove or regenerate `frontend/client.ts` rather than carrying it forward manually.
- Remove runtime DB schema repair after data migration.
- Remove duplicate initial migrations once a clean schema baseline is established.
- Remove public debug/seed/fix endpoints or gate them behind admin auth.

## Things To Migrate Into A Unified System
- One event ingestion interface with typed source adapters.
- Shared Person/Lead/Account model.
- Shared scoring rule engine and score ledger.
- Candidate signal review queue.
- Social inbox and watchlist model.
- Owner contact directory as part of global contact graph.
- Desktop capture companion as optional signal-source adapter.
- Cross-service social contract with DO-Socials.

## Open Questions / Needs Review
- NEEDS REVIEW: Decide whether content planning APIs in this repo are still relevant or should move to the content/social module.
- NEEDS REVIEW: Decide if candidate signal review belongs in DO-Intent or a shared review/workflow service.
- NEEDS REVIEW: Define what historical migrations are reference-only versus required for data migration.
- UNKNOWN: Which generated artifacts are intentionally committed for current deployment.
