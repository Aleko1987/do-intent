# Recent Progress (2026-04-27)

This document captures the latest implemented progress across capture, OCR/LLM enrichment, entity resolution, and review workflows.

## Capture and Enrichment

- Desktop companion hotkey capture supports region and fullscreen screenshot intake.
- OCR runs on captured image content and writes OCR text/confidence/engine metadata.
- OCR output is passed into local LLM extraction with timeout-safe fallback behavior.
- Local LLM output is normalized into strict `lead_candidates_v2` schema.
- Capture metadata persists provenance fields and backwards-compatible legacy fields.

## Backend Intake and Pipeline Shaping

- Capture intake accepts legacy and strict v2 metadata payloads.
- Legacy suggestion blobs are projected into `lead_candidates_v2` when needed.
- Resolver audit metadata is attached for explainable matching decisions.
- Human review remains mandatory for lead creation/merge/promotion.
- Promotion guardrails require explicit approved state and valid owner lead.

## Owner Contact Directory

- Owner-scoped contact/friend directory supports CSV and paste-text import.
- Imports support `full_refresh` and `delta` update modes.
- Platform/source attribution is explicit (`instagram`, `facebook`, etc.).
- Large browseability added with dedicated Contact Directory UI tab.
- Resolver uses imported contacts for exact/prefix/fuzzy matching with confidence.

## Review Queue and Operator UX

- Review queue renders candidate rows with confidence and alternatives.
- Per-candidate edit/select flow supports human decisions before promotion.
- Source channel/platform can be updated per candidate signal card.
- Contact import and contact directory are available directly from Marketing UI.

## Database and Migrations

- Added owner contact directory and import batch audit tables.
- Added platform attribution columns and indexes for owner contact records.
- Added platform-aware uniqueness index for external references.

## Documentation Scope

- Markdown files across the repo now include a pointer to this update document so teams can quickly locate the newest workflow and architecture updates.
