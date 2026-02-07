# DO Intent — Intent + Identity + Growth Plan (Phased)
Date: 2026-02-07
Owner: DO Intent (Encore.dev + Postgres + React/Vite + Clerk)

## Objective
Build a production-grade B2B intent system that:
- Tracks anonymous-first engagement safely
- Promotes anonymous visitors to known leads when they opt in
- Rolls up to account-level intent (ABM)
- Closes the loop with marketing platforms (measurement + optimization)
- Implements Hormozi-style growth mechanics (lead magnets + irresistible offers + channel scaling)

---

# Stage 1 — Operational intent spine (implement now)
Goal: Make the system usable immediately so marketing can start and leads can be worked.

## Stage 1 outcomes
- Anonymous-first tracking runs reliably across sessions
- /identify promotes anonymous → lead/person and merges history + score
- Rule scoring works with decay + saturation (no score inflation)
- Marketing attribution is captured (UTMs + click IDs)
- Basic account rollup works via email domain
- Lead magnet funnel is live (Hormozi-aligned)

## Stage 1 technical scope

### 1) Anonymous-first web tracking
- Create `anonymous_id` on first visit
- Persist via first-party cookie or localStorage
- Create `session_id` (30-min inactivity timeout)

Event fields (minimum):
- event_id (uuid for dedupe)
- anonymous_id, session_id
- ts, url, page_class
- referrer
- utm_source, utm_medium, utm_campaign, utm_content, utm_term
- click ids if present (at minimum gclid, fbclid)

### 2) Identify + score merge
When a visitor opts in (email capture) or signs in via Clerk:
- Resolve canonical_person_id + lead_id
- Create mapping anonymous_id -> canonical_person_id
- Merge:
  - Either reassign historical events to person via mapping
  - Or compute rollups by joining through mapping
- Preserve explainability: store top contributing events + reasons

### 3) Scoring v1 upgrades
Keep rules, add:
- time-decay (half-life)
  - general web: 10–14 days
  - high-intent actions: 21–45 days
- saturation/caps
  - cap page views per 7 days OR log-saturation

### 4) Account rollup v1
- account_id from business email domain (confidence 0.95)
- suppress free email domains
- account_score = sum(top 3 person scores) + diversity bonus
  - diversity bonus if >=2 active people in 14d

## Stage 1 growth scope (Hormozi-aligned)

### 5) Lead magnet funnel (Hook → Story → Offer)
Offer mechanics align to the Value Equation:
- Increase perceived likelihood: templates, examples, proof
- Reduce time delay/effort: done-for-you teardown format
- Add bonuses (no discounting) and ethical urgency

Implementation:
- Top-nav CTA + exit intent on pricing/docs:
  - “Free B2B Intent & Funnel Teardown”
- Capture email (and optionally company) -> /identify -> create lead
- Deliver:
  - immediate automated mini-report
  - optional booked teardown call for qualified leads

---

# Stage 2 — Closed-loop marketing + enrichment (next)
Goal: Turn intent into a growth engine. Improve measurement + FitScore.

## Stage 2 outcomes
- Server-side conversion feedback to platforms improves ad optimization
- FitScore is separated from EngagementScore
- Better ABM: account confidence + topic alignment

## Stage 2 scope

### 1) Official conversion tracking (no scraping)
Implement platform-approved tracking:
- Meta Conversions API / Offline events
- LinkedIn conversion tracking (tag + API where applicable)
- Google Ads offline conversion import (GCLID)

Purpose:
- better attribution under cookie restrictions
- better optimization by ad platforms

### 2) Enrichment + FitScore
Add enrichment provider(s) or internal firmographic rules:
- industry, company size, geo
- role/seniority if captured
FitScore: 0–100 (mostly static)
EngagementScore: decayed behavior intent
Handoff rule: FitScore >= X AND EngagementScore >= Y

### 3) Search demand intelligence (aggregated)
Use Google Search Console API for:
- queries, clicks, impressions, landing pages
Map topics -> content strategy and intent topic tags

---

# Stage 3 — Predictive intent + ABM maturity (later)
Goal: Move from rules to calibrated probability and buying-stage modeling.

## Stage 3 outcomes
- Predictive score: P(book demo) / P(close in 30d)
- Account buying stage estimation (awareness/consideration/eval)
- Sequence scoring + stall detection
- Automated next-best-action suggestions

## Stage 3 scope

### 1) Feature store (daily)
Write daily features per person + account:
- event counts by class in 7/14/30/90
- recency of key actions
- topic diversity
- active_people_14d
- fit fields

### 2) Probabilistic model
Train logistic regression / gradient boosting once labels exist:
- label = demo booked / opp created / closed-won
Output:
- probability + explanation (top contributing features)

### 3) Third-party intent providers (optional)
If budget allows:
- Bombora topic surge
- G2 buyer intent
Ingest as account-level topic signals with decay and baseline-vs-recent spike logic

---

# Policy / Stability constraints
- Avoid scraping social networks and Google SERPs at scale
- Prefer official APIs, first-party tracking, and conversion APIs
- Keep identity opt-in for person-level outreach

