# Render Path Debugging - Current Paths

## Public Health Endpoints
- `GET /` → `{ ok: true, service: "do-intent", ts: "<iso>" }`
- `GET /healthz` → `{ ok: true }` (Render health check)
- `GET /health/version` → `{ gitSha, buildTime }`
- `GET /health` / `GET /ready` / `GET /api/v1/ready` (intent_scorer service)
- `GET /intent-scorer/ping` → `{ ok: true, service: "intent_scorer" }`

## Common Public API Paths
- `GET /intent-scorer/rules` (DB required)
- `POST /intent-scorer/leads` (auth required)
- `POST /intent-scorer/leads/public` (enabled by `DISABLE_AUTH_FOR_INTENT_LIST=true`)
- `POST /intent-scorer/lead-rollups`, `/lead-trend`, `/lead-top-signals`

## Website Tracking Paths
- `POST /track` / `POST /api/v1/track` (DB persistence gated by `ENABLE_DB`)
- `POST /identify` / `POST /api/v1/identify` (anonymous → identity)
- `POST /marketing/ingest-intent-event` / `POST /api/v1/ingest` (requires `x-ingest-api-key` in production)
- `POST /marketing/identify` (uses `x-do-intent-key`)

## Notes
- Encore endpoints are not prefixed with `/api` except explicit `/api/v1/*` paths.
- If you see 404s on known paths, confirm Render is running the GHCR Docker image (not `render.yaml`).
- Use `/healthz` for Render health checks and `/health/version` to confirm deployed build info.
