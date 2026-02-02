# Render Build Instructions

## Build Command

The exact build command that must be set for the backend service in Render:

### If Render Root Directory is `backend`:

```bash
npm ci && npm run build && export ENCORE_INSTALL="$PWD/.encore" && curl -L https://encore.dev/install.sh | bash && ./.encore/bin/encore version
```

### If Render Root Directory is Repository Root:

```bash
cd backend && npm ci && npm run build && export ENCORE_INSTALL="$PWD/.encore" && curl -L https://encore.dev/install.sh | bash && ./.encore/bin/encore version
```

This will:
1. Install dependencies using `npm ci` (uses lockfile for reproducible builds)
2. Build the frontend using Vite, outputting to `backend/frontend/dist`
3. Install Encore CLI to `.encore/bin/encore` (required for deployment)
4. Verify Encore installation by running `encore version`

## Start Command

Render should use the following start command:

```bash
encore run --listen 0.0.0.0:${PORT}
```

The `${PORT}` environment variable is automatically provided by Render.

## Build Output

After a successful build, the following directory should exist:
- `backend/frontend/dist/` - Contains the built frontend SPA files
- `backend/frontend/dist/index.html` - The main HTML file for the SPA
- `.encore/bin/encore` - Encore CLI binary (required for start command)

## Notes

- The build script uses `npm ci` instead of `bun install` for compatibility with Render's Node.js runtime
- The frontend is built using Vite with output directory `../backend/frontend/dist`
- The `--emptyOutDir` flag ensures a clean build each time
- Encore CLI is installed during the build step and must be available for the start command

## Verification Steps

After deployment, verify the following endpoints:

- `GET https://do-intent.onrender.com/healthz` should return `200` with JSON `{"ok": true}`
- `GET https://do-intent.onrender.com/api/v1/ready` should return `200` with service status
- `GET https://do-intent.onrender.com/app` should return `200` with `content-type: text/html; charset=utf-8` (serves SPA index.html)
- `GET https://do-intent.onrender.com/app/marketing` should return `200` with `content-type: text/html; charset=utf-8` (SPA deep link fallback)

