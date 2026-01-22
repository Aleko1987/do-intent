# Render Deployment Notes

## Health Check

Render can use the following endpoint to verify the service is up:

- `GET https://do-intent.onrender.com/ready`

The endpoint returns JSON like:

```json
{
  "ok": true,
  "service": "do-intent",
  "ts": "2024-01-01T00:00:00.000Z"
}
```
