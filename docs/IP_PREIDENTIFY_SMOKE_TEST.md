# IP Pre-Identify Qualification Smoke Test

This checklist verifies that repeated anonymous visits from the same IP fingerprint increase
pre-identify score and that score carries forward when identify happens.

## Preconditions

- `ENABLE_DB=true`
- latest migrations applied (including `022_add_ip_preidentify_scoring.up.sql`)
- `IP_HASH_SALT` configured in production (recommended)

## 1) Send repeated anonymous traffic from same client

Use the same `anonymous_id` and session/IP source for multiple `/track` calls.

```powershell
$base = "https://do-intent.onrender.com"
$anon = "11111111-1111-1111-1111-111111111111"
$session = "22222222-2222-2222-2222-222222222222"

1..3 | ForEach-Object {
  Invoke-RestMethod -Method Post -Uri "$base/track" -ContentType "application/json" -Body (@{
    event       = "page_view"
    session_id  = $session
    anonymous_id = $anon
    url         = "https://earthcurebiodiesel.com/pricing"
    timestamp   = (Get-Date).ToString("o")
    metadata    = @{ page = "pricing" }
  } | ConvertTo-Json -Depth 5)
}
```

Expected:
- requests return `ok: true`
- backend logs show IP fingerprint capture and repeat-visit boost applied after first event

## 2) Verify IP fingerprint state increments

Run a DB query:

```sql
SELECT ip_fingerprint, total_events, boost_score_total, last_seen_at
FROM intent_ip_fingerprint_scores
ORDER BY updated_at DESC
LIMIT 5;
```

Expected:
- same fingerprint row has `total_events >= 3`
- `boost_score_total` increased (if `ip_boost_enabled=true`)

## 3) Trigger identify for that anonymous visitor

```powershell
Invoke-RestMethod -Method Post -Uri "$base/marketing/identify" -Headers @{
  "x-do-intent-key" = "<INGEST_API_KEY>"
  "Content-Type" = "application/json"
} -Body (@{
  anonymous_id = $anon
  email = "ip-smoke@example.com"
  contact_name = "IP Smoke"
  company_name = "IP Carry Forward Inc"
} | ConvertTo-Json)
```

Expected:
- returns `lead_id`
- identify logs include carry-forward message with `carried_score`

## 4) Verify lead score reflects pre-identify carry-forward

```sql
SELECT id, email, intent_score, marketing_stage, last_signal_at
FROM marketing_leads
WHERE lower(email) = lower('ip-smoke@example.com')
ORDER BY updated_at DESC
LIMIT 1;
```

Expected:
- `intent_score` is greater than zero and includes carried anonymous/IP contribution
- stage aligns with configured thresholds
