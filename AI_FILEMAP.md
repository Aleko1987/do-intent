# File Map - DO Intent Project

## Backend Structure
```
backend/
├── db/
│   ├── index.ts                    # DB connection
│   └── migrations/                 # SQL migrations
├── intent_scorer/
│   ├── encore.service.ts           # Service definition
│   ├── types.ts                    # TypeScript interfaces
│   ├── list_events.ts              # List scored events
│   ├── compute_score.ts            # Score single event
│   ├── recompute_scores.ts         # Batch recompute
│   ├── list_rules.ts               # CRUD rules
│   └── update_rule.ts
├── marketing/
│   ├── encore.service.ts
│   ├── types.ts                    # MarketingLead, IntentEvent
│   ├── list_leads.ts               # Basic lead listing
│   └── create_lead.ts
└── auth/
    └── auth.ts                     # Clerk auth handler
```

## Frontend Structure
```
frontend/
├── pages/
│   ├── IntentScorer.tsx            # Main intent scorer page
│   └── Marketing.tsx               # Marketing pipeline
├── components/
│   ├── intent/
│   │   ├── EventsTab.tsx
│   │   ├── ScoresTab.tsx
│   │   └── RulesTab.tsx
│   └── ui/                         # shadcn components
├── lib/
│   ├── useBackend.ts               # Backend client hook
│   └── utils.ts
└── App.tsx                          # Router setup
```

## Key Files for Leads Dashboard (A)
- Backend: `backend/intent_scorer/list_leads_intent.ts` (NEW)
- Frontend: `frontend/components/intent/LeadsTab.tsx` (NEW)
- Frontend: `frontend/pages/IntentScorer.tsx` (UPDATE - add Leads tab)

