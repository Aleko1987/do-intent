# AI Database

## Provider
- **Database:** Postgres.
- **Driver:** `pg` Pool through `backend/db/db.ts`.
- **Migrations:** SQL files in `backend/db/migrations/`.
- **Docs schema reference:** `docs/intent-tracking-schema.sql` for part of the tracking schema.
- **Runtime repair:** `backend/db/db.ts` and `web/server.ts` add/ensure some `marketing_leads` columns/indexes at startup. This is transitional and should be removed in a rebuild.

## Main Tables
| Table | Purpose | Important Fields / Notes |
|---|---|---|
| `marketing_leads` | Pipeline lead/contact records | `owner_user_id`, `company_name`, `contact_name`, `email`, `phone`, `anonymous_id`, `clerk_id`, `source_type`, `marketing_stage`, `intent_score`, `last_signal_at`, soft-delete/merge fields. |
| `intent_events` | Lead-linked or anonymous normalized intent events | `lead_id`, `anonymous_id`, `event_type`, `event_source`, `event_value`, `dedupe_key`, `metadata`, `occurred_at`. |
| `scoring_rules` | Earlier/simple scoring rule table | `event_type`, points/stage fields. |
| `intent_scores` | Score rows for intent events | `intent_event_id`, `score`, `confidence`, `reasons`, `model_version`. |
| `lead_intent_rollups` | Aggregated lead scores | `lead_id`, `score_7d`, `score_30d`, `last_event_at`. |
| `intent_rules` | Configurable scoring rule engine | `rule_key`, `rule_type`, `event_type`, `modifier_condition`, `points`, `is_active`. |
| `sessions` | Anonymous website sessions | `session_id`, `anonymous_id`, `identity_id`, first/last seen metadata. |
| `events` | Raw website tracking events | `event_type`, `session_id`, `anonymous_id`, `identity_id`, `url`, `referrer`, `event_value`, `metadata`, `occurred_at`. |
| `identities` | Canonical known identity records | Email/name/source and first/last seen data. |
| `intent_subject_scores` | Anonymous/identity incremental score state | `subject_type`, `subject_id`, `total_score`, `last_event_at`, threshold state. |
| `intent_signals` | Emitted intent threshold/signals | Lead/band/payload/timestamps. |
| `accounts` | Account/domain rollups | Account-level grouping; details need schema review. |
| `account_members` | Identity-account membership | Maps identities to accounts. |
| `lead_scoring_config` | Owner/configurable scoring settings | Used by marketing scoring config endpoints. |
| `intent_ip_fingerprint_scores` | IP pre-identify scoring | IP fingerprint score state. |
| `candidate_signals` | Reviewable candidate lead/contact signals | Owner, channel, signal type, dedupe/provenance, status, linked lead, candidate metadata. |
| `candidate_signal_evidence` | Evidence attached to candidate signals | Screenshot/OCR/metadata/evidence status/reminder linkage. |
| `candidate_signal_reviews` | Human review audit trail | Reviewer decisions and timestamps. |
| `candidate_signal_reminders` | Reminder records for candidate review | Owner/status/reminder metadata. |
| `review_queue_reminder_settings` | Per-owner reminder settings | Settings for review queue nudges. |
| `owner_contact_import_batches` | Import batch audit for owner contacts | Owner/source/platform/import mode/counts. |
| `owner_contact_directory` | Owner-scoped contacts/friends directory | Name, external refs, platform/source/scope, active status. |
| `social_watchlists` | Social profiles to monitor | Owner, lead, platform, external profile ref, priority, enabled. |
| `inbox_tasks` | Social inbox review/execution tasks | Owner, source event id, platform, event/task type, status, priority, lead, actor/target/source, suggested reply, payload. |
| `action_budgets` | Risk-control budget ledger | Owner, platform, action type, budget date, used/cap count. |
| `execution_attempts` | Social execution attempt audit | Owner, task, status, request/response payload, error, attempted timestamp. |
| `social_activity_events` | Successful/recorded social execution events | Owner, lead, inbox task, execution attempt, idempotency key, platform/action refs. |
| `lead_score_ledger` | Idempotent scoring ledger | Owner, lead, source kind/id, inbox task, execution attempt, score rule, delta, previous/new score, reason, metadata. |
| `content_items` | Authenticated content planning items | Title/body/channels/CTA/UTM/scheduling/status/creator fields. |
| `content_post_logs` | Content publishing logs | Content item, channel, posted status, platform response. |

## Migrations
- Numbered migrations run from `backend/db/migrations/*.up.sql`.
- Important groups:
  - `002` to `005`: marketing leads, intent events, content items, scoring tables, dedupe.
  - `006` to `013`: anonymous tracking, identities, subject scores, intent signals, website rules.
  - `014` to `022`: account rollups, ownership conversion, lead identifiers, scoring config, IP pre-identify scoring.
  - `023` to `025`: candidate signal review pipeline and repair.
  - `026`: social inbox tables.
  - `027` to `031`: review reminders and owner contact directory.
  - `032`: social execution scoring ledger.
- `1_init.up.sql` / `1_init.down.sql` coexist with numbered migrations and need review.

## Relationships
- `intent_events.lead_id` can link to `marketing_leads.id`, but migrations made `lead_id` nullable.
- `intent_scores.intent_event_id` links to `intent_events`.
- `lead_intent_rollups.lead_id` links conceptually to `marketing_leads`.
- `sessions.identity_id` links to `identities`.
- `account_members.identity_id` links conceptually to `identities`; `accounts` group by domains.
- Candidate signal evidence/reviews/reminders link to `candidate_signals`.
- Social inbox `inbox_tasks` can link to `marketing_leads` and are scoped by `owner_user_id`.
- `execution_attempts` link to `inbox_tasks`.
- `social_activity_events` and `lead_score_ledger` bridge social execution into scoring.
- Content post logs link to `content_items`.

## Data Ownership Model
- Many newer tables use `owner_user_id`, usually from Clerk auth.
- Older/canonical identity tables (`identities`, `sessions`, `events`) are not obviously workspace-scoped.
- Lead uniqueness evolved from global email toward owner-scoped email/anonymous indexes.
- There is not yet a clear organization/workspace model.

## Soft Delete / Merge Logic
- `marketing_leads` has `deleted_at` and `merged_to_id` runtime/migration support.
- Some delete routes may hard-delete or mark deleted depending on implementation; check route-specific code before relying on soft delete.
- Candidate signal review/promotion status acts as workflow state rather than deletion.

## Duplicated Or Confusing Entities
- `events` and `intent_events` both represent event-like data for different ingestion paths.
- `scoring_rules` and `intent_rules` both exist.
- `intent_subject_scores`, `intent_scores`, `lead_intent_rollups`, `marketing_leads.intent_score`, and `lead_score_ledger` all store score-related state.
- `identities` and `marketing_leads` are both person-like but serve different roles.
- `accounts` and marketing/company fields overlap conceptually.
- `1_init.up.sql` duplicates some concepts from numbered migrations.

## Open Questions / Needs Review
- NEEDS REVIEW: Define canonical entities for Person/Lead/Account before unification.
- NEEDS REVIEW: Decide whether raw website events and normalized intent events should merge into one event table with typed projections.
- NEEDS REVIEW: Remove runtime schema repair after confirmed migrations.
- UNKNOWN: Production database has not been introspected in this docs-only pass.
