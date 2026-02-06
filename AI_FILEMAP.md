# File Map - DO Intent Project

## Backend Structure
```
backend/
├── db/
│   ├── db.ts                       # DB connection
│   └── migrations/                 # SQL migrations
├── intent_scorer/
│   ├── encore.service.ts           # Service definition
│   ├── types.ts                    # TypeScript interfaces
│   ├── track.ts                    # Public /track endpoint (DB gated)
│   ├── identify.ts                 # Anonymous -> identity promotion
│   ├── health.ts                   # /health, /ready endpoints
│   ├── ping.ts                     # /intent-scorer/ping
│   ├── list_events.ts              # List scored events
│   ├── compute_score.ts            # Score single event
│   ├── recompute_scores.ts         # Batch recompute
│   ├── list_rules.ts               # CRUD rules
│   ├── update_rule.ts              # Update rule points
│   ├── list_leads_intent.ts        # Auth/protected leads list
│   ├── list_lead_rollups.ts        # Lead rollups (UI)
│   ├── get_lead_trend.ts           # Lead trend (sparkline)
│   ├── get_lead_top_signals.ts     # Top signals per lead
│   └── seed_demo.ts                # Seed demo data
├── marketing/
│   ├── encore.service.ts
│   ├── types.ts                    # MarketingLead, IntentEvent
│   ├── identify.ts                 # /marketing/identify
│   ├── ingest_intent_event.ts      # /marketing/ingest-intent-event + /api/v1/ingest
│   ├── webhook_event.ts            # /marketing/events
│   ├── events.ts                   # /api/v1/events debug list
│   ├── list_leads.ts               # Basic lead listing
│   └── create_lead.ts
├── health/
│   └── health.ts                   # /, /healthz, /health/version
├── debug/
│   └── debug_dbinfo.ts             # /api/v1/debug/dbinfo
├── content/                        # Content planning APIs
└── auth/
    └── auth.ts                     # Clerk auth handler
```

## Frontend Structure
```
frontend/
├── pages/
│   ├── IntentScorer.tsx            # Intent scorer UI (Leads/Events/Scores/Rules)
│   ├── LeadIntent.tsx              # Lead intent dashboard
│   ├── Marketing.tsx               # Marketing pipeline
│   ├── Contact.tsx                 # Contact form + tracking
│   ├── Pricing.tsx                 # Pricing page tracking
│   └── CaseStudy.tsx               # Case study tracking
├── components/
│   ├── intent/
│   │   ├── LeadsTab.tsx
│   │   ├── EventsTab.tsx
│   │   ├── ScoresTab.tsx
│   │   ├── RulesTab.tsx
│   │   └── LeadIntentDrawer.tsx
│   ├── marketing/                  # Marketing pipeline components
│   └── ui/                         # shadcn components
├── lib/
│   ├── doIntent.ts                 # Lead-based website integration
│   ├── doIntentTracker.ts          # Anonymous-first tracking
│   ├── useBackend.ts               # Backend client hook
│   └── utils.ts
└── App.tsx                          # Router setup
```

## Key Files for Leads + Intent Dashboards
- Backend: `backend/intent_scorer/list_leads_intent.ts`
- Backend: `backend/intent_scorer/list_lead_rollups.ts`
- Backend: `backend/intent_scorer/get_lead_trend.ts`
- Backend: `backend/intent_scorer/get_lead_top_signals.ts`
- Frontend: `frontend/components/intent/LeadsTab.tsx`
- Frontend: `frontend/components/intent/LeadIntentDrawer.tsx`
- Frontend: `frontend/pages/IntentScorer.tsx`
- Frontend: `frontend/pages/LeadIntent.tsx`

## Tracking & Ingest Environment Variables
- `ENABLE_DB`: gates `/track` and `/api/v1/track` Postgres writes.
- `DATABASE_URL`: Postgres connection string (pg Pool).
- `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOSTPORT`, `DATABASE_NAME`: fallback DB config.
- `INGEST_API_KEY`: required in production for `/marketing/ingest-intent-event` and `/api/v1/ingest` (`x-ingest-api-key`).
- `ALLOWED_INGEST_ORIGINS`: optional origin allowlist.
- `DISABLE_AUTH_FOR_INTENT_LIST`: enables `/intent-scorer/leads/public`.

## Track Endpoint Behavior Matrix
| ENABLE_DB | DB configured | DB reachable | Response |
| --- | --- | --- | --- |
| not `"true"` | n/a | n/a | `200 { ok: true, stored: false, reason: "db_disabled" }` |
| `"true"` | yes | yes | `200 { ok: true, stored: true }` |
| `"true"` | no | n/a | `200 { ok: true, stored: false, reason: "db_error" }` |
| `"true"` | yes | no / error | `200 { ok: true, stored: false, reason: "db_error", error_code: "<safe>" }` |
