# AI API

## API Framework
- Primary backend APIs are Encore endpoints declared with `api(...)` and `api.raw(...)`.
- Generated frontend client lives at `frontend/client.ts`; treat as generated output.
- Some raw endpoints manually implement CORS/auth/body parsing.

## Auth Requirements
| Auth Type | Used By |
|---|---|
| Clerk `auth: true` | Protected lead/content/intent/social review APIs. |
| `x-ingest-api-key` | Production ingest endpoints such as `/marketing/ingest-intent-event` and `/api/v1/ingest`. |
| `x-do-intent-key` | `/marketing/identify` identify flow. |
| Capture bearer token | `/marketing/capture-intake`. |
| `Authorization: Bearer ${DO_SOCIALS_INGEST_TOKEN}` | `/social-events/ingest`. |
| Public/no auth | Health, tracker, debug/testing, app static serving, selected list endpoints. |

## Health / Frontend Serving
| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/healthz` | Render/health check. | Public |
| GET | `/health` | Health check. | Public |
| GET | `/ready` | Ready check. | Public |
| GET | `/api/v1/ready` | Versioned ready check. | Public |
| GET/HEAD | `/app` | Serve built frontend app. | Public |
| GET/HEAD | `/app/*path` | Serve frontend assets/SPAs paths. | Public |

## Anonymous Tracking / Identify
| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/track` | Anonymous website tracking; persistence gated by `ENABLE_DB`. | Public |
| OPTIONS | `/track` | CORS preflight. | Public |
| GET | `/track` | Tracking info endpoint. | Public |
| POST | `/api/v1/track` | Versioned anonymous tracking. | Public |
| OPTIONS | `/api/v1/track` | CORS preflight. | Public |
| POST | `/intent_scorer/track` | Service-scoped/legacy tracking path. | Public |
| OPTIONS | `/intent_scorer/track` | CORS preflight. | Public |
| POST | `/identify` | Promote anonymous visitor to identity. | Public/key behavior needs review |
| POST | `/api/v1/identify` | Versioned identify. | Public/key behavior needs review |
| OPTIONS | `/api/v1/identify` | CORS preflight. | Public |
| GET | `/intent_scorer/fix-db` | DB repair/debug endpoint. | Public; needs review |

## Intent Scorer
| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/intent-scorer/ping` | Ping endpoint. | Public |
| POST | `/intent-scorer/events` | List scored events. | Public |
| POST | `/intent-scorer/compute` | Compute score for one event. | Public |
| POST | `/intent-scorer/recompute` | Batch recompute scores. | Public |
| GET | `/intent-scorer/rules` | List scoring rules. | Clerk |
| POST | `/intent-scorer/rules/update` | Update scoring rule. | Clerk |
| POST | `/intent-scorer/seed-demo` | Seed demo data. | Public; needs review |
| POST | `/intent-scorer/leads` | Protected lead intent list. | Clerk |
| POST | `/intent-scorer/leads/public` | Testing-only public lead list when enabled. | Public gated by env |
| POST | `/intent-scorer/lead-rollups` | Lead rollup list. | Public |
| POST | `/intent-scorer/lead-trend` | Lead trend buckets. | Public |
| POST | `/intent-scorer/lead-top-signals` | Top scored signals for a lead. | Public |

## Marketing Leads / Events
| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/marketing/leads` | List leads, optional stage/limit. | Marked `auth: false` |
| POST | `/marketing/leads` | Create lead. | Clerk |
| PATCH | `/marketing/leads/:id` | Update lead. | Clerk |
| DELETE | `/marketing/leads/:id` | Delete lead. | Clerk |
| GET | `/marketing/leads/:id/events` | Fetch lead with events. | Clerk |
| POST | `/marketing/leads/:id/events` | Create event for lead and score it. | Clerk |
| POST | `/marketing/events` | Webhook-style event ingest. | Public/key behavior needs review |
| GET | `/api/v1/events` | Debug/list normalized events. | Public |
| POST | `/marketing/identify` | Lead-based identify/upsert. | API key in docs |
| OPTIONS | `/marketing/identify` | CORS preflight. | Public |
| POST | `/marketing/ingest-intent-event` | Lead event ingest. | API key in production |
| POST | `/api/v1/ingest` | Versioned lead event ingest. | API key in production |
| OPTIONS | `/marketing/ingest-intent-event` | CORS preflight. | Public |
| OPTIONS | `/api/v1/ingest` | CORS preflight. | Public |
| GET | `/debug/schema/marketing-leads` | Schema debug. | Public; needs review |

## Candidate Signal Review
| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/marketing/capture-intake` | Companion/manual capture intake. | Capture token |
| OPTIONS | `/marketing/capture-intake` | CORS preflight. | Public |
| GET | `/marketing/candidate-signals` | List reviewable candidate signals. | Clerk |
| POST | `/marketing/candidate-signals` | Ingest candidate signal. | Clerk |
| POST | `/marketing/candidate-signals/:id/evidence` | Attach evidence. | Clerk |
| POST | `/marketing/candidate-signals/:id/reviews` | Review candidate signal. | Clerk |
| POST | `/marketing/candidate-signals/:id/create-lead` | Create lead from candidate signal. | Clerk |
| POST | `/marketing/candidate-signals/:id/merge-lead` | Merge candidate signal into lead. | Clerk |
| POST | `/marketing/candidate-signals/:id/promote` | Promote approved signal. | Clerk |
| GET | `/marketing/candidate-signals/:id/reminders` | List reminders. | Clerk |
| POST | `/marketing/candidate-signals/:id/reminders` | Request reminder. | Clerk |
| GET | `/marketing/review-reminder-settings` | Read reminder settings. | Clerk |
| PATCH | `/marketing/review-reminder-settings` | Update reminder settings. | Clerk |

## Owner Contacts / Accounts / Config
| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/marketing/owner-contacts/import` | Import owner contacts. | Clerk |
| GET | `/marketing/owner-contacts` | List owner contact directory. | Clerk |
| POST | `/marketing/owner-contacts/repair` | Repair contact directory data. | Clerk |
| POST | `/accounts/list` | List account rollups. | Public |
| POST | `/accounts/get` | Get account. | Public |
| GET | `/marketing/scoring-config` | Read lead scoring config. | Clerk |
| PATCH | `/marketing/scoring-config` | Update lead scoring config. | Clerk |

## Content Planning
| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/content/items` | List content items. | Clerk |
| POST | `/content/items` | Create content item. | Clerk |
| PATCH | `/content/items/:id` | Update content item. | Clerk |
| DELETE | `/content/items/:id` | Delete content item. | Clerk |
| POST | `/content/items/:id/logs` | Log a content post. | Clerk |

## Social Inbox / DO-Socials Contract
| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/social-events/ingest` | Receive `NormalizedSocialEvent` from DO-Socials and create inbox task. | Service bearer |
| GET | `/inbox/tasks` | List social inbox tasks. | Clerk |
| POST | `/inbox/tasks/:id/approve` | Approve task for execution. | Clerk |
| POST | `/inbox/tasks/:id/reject` | Reject task. | Clerk |
| POST | `/inbox/tasks/:id/execute` | Execute approved task through DO-Socials and optionally score result. | Clerk |
| GET | `/watchlists` | List social watchlists. | Clerk |
| POST | `/watchlists` | Create/upsert watchlist. | Clerk |
| POST | `/watchlists/:id` | Update watchlist. | Clerk |
| DELETE | `/watchlists/:id` | Delete watchlist. | Clerk |

## Missing Or Unclear API Coverage
- Public exposure of debug/seed/repair endpoints needs review.
- Some endpoints marked public rely on internal key checks in raw handlers; document schemas before rebuild.
- `/marketing/leads` list is currently `auth: false`, while create/update/delete are protected.
- CORS and auth behavior is implemented differently across raw handlers.

## Open Questions / Needs Review
- NEEDS REVIEW: Collapse duplicate tracking/identify/ingest routes into a versioned API contract.
- NEEDS REVIEW: Decide which public endpoints remain public in a unified production system.
- NEEDS REVIEW: Define stable request/response schemas for all cross-service endpoints.
- UNKNOWN: Which endpoints are actively used by external websites or other repos today.
