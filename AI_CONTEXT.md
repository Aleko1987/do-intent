# AI Context - DO Intent Project

## Project Overview
Sales Intelligence platform with deterministic intent scoring engine. Focus: sales-usable outputs, not posting/scheduling/OAuth/CRM tasks.

## Tech Stack
- Backend: Encore.dev (TypeScript), Neon Postgres
- Frontend: React, TypeScript, Vite, Clerk auth
- UI: shadcn/ui components

## Database Schema (Stable - DO NOT MODIFY)
- `marketing_leads`: company/contact info, owner_user_id, marketing_stage
- `intent_events`: events linked to leads, event_type, event_source, metadata, occurred_at
- `intent_scores`: 1:1 with events, score, confidence, reasons[]
- `lead_intent_rollups`: 7d/30d aggregated scores per lead, last_event_at
- `intent_rules`: configurable scoring rules (base_score, modifier)

## Key Services
- `intent_scorer`: scoring engine, list events, compute/recompute scores, CRUD rules
- `marketing`: lead management, event creation, webhooks

## UI Structure
- `/intent-scorer`: Events, Scores, Rules tabs
- `/marketing`: Marketing pipeline (existing)
- `/leads`: NEW - Lead-level intent dashboard (to be built)

## Implementation Notes
- Backend is server-side only, Neon Postgres is source of truth
- React UI is inspection + action, no vanity
- Do NOT refactor stable code
- Do NOT rename files
- Do NOT change DB schema unless absolutely required

