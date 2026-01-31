# Render Deployment Notes

## Health Check

Render should use the following endpoint to verify the service is up:

- `GET https://do-intent.onrender.com/healthz`

The endpoint returns JSON like:

```json
{
  "ok": true
}
```

## Public Endpoints

### Root Endpoint

The root endpoint provides a simple service status check:

- `GET https://do-intent.onrender.com/`

Returns JSON:

```json
{
  "ok": true,
  "service": "do-intent",
  "ts": "2024-01-01T00:00:00.000Z"
}
```

This endpoint is public (no authentication required) and works in browsers, resolving the 502 error that sometimes appeared at the base URL.

### Other Health Endpoints

- `GET https://do-intent.onrender.com/api/v1/ready` - Returns service status with timestamp
- `GET https://do-intent.onrender.com/healthz` - Simple health check (recommended for Render)
