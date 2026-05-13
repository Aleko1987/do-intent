# AI Unification Notes

## Recommended Role In A Unified Platform
- Treat DO-Intent as the **intent/event intelligence layer**.
- It should not own every downstream action. It should score, explain, route, and audit signals.
- Use it as a canonical source for:
  - Intent events.
  - Signal scoring rules.
  - Lead/account intent state.
  - Reviewable candidate signals.
  - Social inbox task orchestration.

## Entities That Should Become Shared Globally
| Entity | Why |
|---|---|
| User | Clerk user IDs appear throughout owner-scoped data; should map to platform users. |
| Workspace / Organization | Current `owner_user_id` is not enough for team workflows. |
| Person / Identity | `identities`, `marketing_leads`, and owner contacts need a common person/contact model. |
| Lead | Marketing lead pipeline records should become shared sales/CRM entities or explicit projections. |
| Account / Company | Company/account rollups should be global, not split across lead fields and accounts tables. |
| Event | Website, social, webhook, and manual capture events should share a canonical event envelope. |
| Score / Ledger | Score changes should be ledgered once and projected into rollups. |
| Review Task | Candidate signals and social inbox tasks could share workflow/task primitives. |
| Integration Credential | API keys, Clerk auth, social service tokens, and capture tokens should use one secret/integration model. |

## Modules That Should Remain Separate
- Intent scoring engine and rule evaluation.
- Signal ingestion adapters:
  - Website tracker.
  - Social event adapter.
  - Companion screenshot intake.
  - Webhook/CRM import adapter.
- Human review workflow for candidate signals.
- Social inbox orchestration, while execution remains in DO-Socials.
- Desktop companion app as an optional capture client.

## Logic That Could Be Reused
- Anonymous-first tracking and identify promotion.
- Deterministic scoring rules with explanations.
- Lead rollup computation.
- IP pre-identify scoring concept.
- Candidate signal parsing, review, and promotion guardrails.
- Owner contact directory resolver.
- Social inbox risk controls: daily budgets, cooldowns, human approval.
- Idempotent social execution scoring ledger.
- Cross-repo `NormalizedSocialEvent` and `ExecuteTaskRequest/Response` contract.

## Parts That Should Probably Be Rebuilt Cleanly
- Database schema baseline.
- Ingestion API surface, to remove duplicate route families.
- Auth/API gateway, to eliminate mixed raw handler/public endpoint behavior.
- Person/Lead/Account/entity resolution model.
- Score storage, to reduce multiple overlapping score tables.
- Deployment pipeline, to remove deprecated Render YAML and generated artifacts from source.
- Frontend API client/auth injection.
- Runtime migration/schema repair.

## Suggested Unification Strategy
1. Extract all docs and endpoint/schema facts into a shared blueprint.
2. Define canonical platform primitives: workspace, user, person, account, lead, event, score ledger, review task.
3. Map current DO-Intent tables to those primitives.
4. Decide canonical event sources and adapters.
5. Create a clean schema baseline from current migrations rather than replaying all historical repair migrations.
6. Preserve scoring behavior with tests before changing implementation.
7. Rebuild UI around operator workflows: ingest health, leads, signal review, social inbox, scoring rules.
8. Reintroduce companion capture only after the core review/task model is stable.

## Risks When Merging With Other Repos
- Lead/account duplication with sales or CRM repos.
- Content planning overlap with `content-flow`.
- Social execution overlap with DO-Socials.
- Auth mismatch between Clerk and any future platform auth.
- Event schema drift between website tracking, social events, and marketing events.
- Historical migrations may not represent desired future schema.
- Public/testing endpoints could become accidental production attack surface.

## Open Questions / Needs Review
- NEEDS REVIEW: Decide if `owner_user_id` maps to user, workspace, or both.
- NEEDS REVIEW: Decide whether DO-Intent remains a service or becomes a module in a unified monorepo.
- NEEDS REVIEW: Define how Content Flow `content_items` and DO-Intent `content_items` relate, if at all.
- UNKNOWN: Which other repos already define Person/Lead/Account concepts.
