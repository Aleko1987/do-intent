# AI Context (Docs Supplement)

> Recent cross-system updates: see `docs/RECENT_PROGRESS_2026-04-27.md`.

## Track endpoint DB gating
- `ENABLE_DB` controls whether `/track` attempts Postgres writes.
- When `ENABLE_DB` is not `"true"`, the endpoint short-circuits and returns `200` with `stored: false` and `reason: "db_disabled"` to avoid any auth or DB activity.
- Render image deploys default `ENABLE_DB` to false because the Encore image runs without local Encore SQL provisioning; DB writes are explicitly gated to prevent 500s during deploy/runtime.
