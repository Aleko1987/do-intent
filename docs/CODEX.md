# DO-Intent — Codex Build Instructions

You are operating inside the DO-Intent codebase.

## Mandatory First Step

Before making any changes:
1. Read ARCHITECTURE.md fully
2. Follow deterministic, real-time scoring rules
3. Do not add AI, queues, dashboards, or UI

---

## Build Order (Strict)

1. Database schema
2. /track endpoint
3. Scoring engine
4. Threshold evaluator
5. /identify endpoint
6. Website tracker snippet ✅ (See [WEBSITE_TRACKER.md](./WEBSITE_TRACKER.md))
7. Internal intent signal emitter

Do not skip steps.

---

## Endpoint Contracts

### POST /track

Purpose:
- Receive raw event
- Persist it
- Update intent score
- Evaluate thresholds

Input:
{
  "event": "page_view",
  "session_id": "uuid",
  "anonymous_id": "uuid",
  "url": "/pricing",
  "referrer": "google",
  "timestamp": 1700000000,
  "metadata": {
    "device": "mobile",
    "country": "ZA"
  }
}

Rules:
- Must not block frontend
- Must be idempotent-safe
- Must be fast (<50ms)

---

### POST /identify

Purpose:
- Link anonymous history to identity
- Merge scores
- Re-run threshold evaluation

Input:
{
  "anonymous_id": "uuid",
  "identity": {
    "email": "user@example.com",
    "name": "Optional"
  }
}

Rules:
- Identity merge must be atomic
- Score transfer must occur once
- Thresholds must re-evaluate

---

## Scoring Engine Rules

- Scoring is incremental
- Never recompute from full event history
- Use configuration-based weights
- One event → one delta
- Update intent_scores table immediately

---

## Threshold Evaluation Logic

Pseudo-logic:

if new_score crosses threshold
  AND threshold not previously emitted
    emit intent_signal
    persist last_threshold_emitted

Threshold evaluation occurs:
- After every /track
- After /identify merge

---

## Intent Signal Emission

Intent signals are internal events only.

They may:
- Be logged
- Be pushed to webhook
- Be forwarded to Telegram / DO-Sales later

DO-Intent does NOT:
- Send WhatsApps
- Send emails
- Create CRM messages directly

---

## Constraints (Non-Negotiable)

❌ No dashboards
❌ No AI scoring
❌ No async queues
❌ No platform-specific logic outside event metadata
❌ No direct sales logic

---

## Success Criteria

- Real-time scoring works
- Thresholds fire instantly
- Identity merge triggers immediate signals
- System remains simple and explainable

If the website intent loop is solid,
all other platforms become trivial to add.

