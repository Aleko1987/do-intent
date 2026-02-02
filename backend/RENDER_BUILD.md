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
encore run --listen 0.0.0.0:${PORT} --watch=false --browser=never
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

After deployment, verify the following endpoints to confirm the correct commit is deployed:

### Health Check Endpoints

1. **Basic Health Check**
   ```bash
   curl https://do-intent.onrender.com/healthz
   # Expected: 200 OK, JSON: {"ok":true}
   ```

2. **Ready Endpoint**
   ```bash
   curl https://do-intent.onrender.com/api/v1/ready
   # Expected: 200 OK, JSON with service status and timestamp
   ```

3. **Version Endpoint** (verifies deployed commit)
   ```bash
   curl https://do-intent.onrender.com/health/version
   # Expected: 200 OK, JSON: {"gitSha":"<commit-sha>","buildTime":"<iso-timestamp>"}
   # gitSha should match the deployed commit (not "unknown")
   # buildTime should be recent (within deployment window)
   ```

### SPA Routes (must return HTML)

4. **SPA Root**
   ```bash
   curl -I https://do-intent.onrender.com/app
   # Expected: 200 OK, Content-Type: text/html; charset=utf-8
   ```

5. **SPA Deep Link** (tests SPA fallback routing)
   ```bash
   curl -I https://do-intent.onrender.com/app/marketing
   # Expected: 200 OK, Content-Type: text/html; charset=utf-8
   ```

### PowerShell Verification (Windows)

```powershell
# Health checks
Invoke-WebRequest -Uri "https://do-intent.onrender.com/healthz" | Select-Object StatusCode, Content
Invoke-WebRequest -Uri "https://do-intent.onrender.com/api/v1/ready" | Select-Object StatusCode, Content
Invoke-WebRequest -Uri "https://do-intent.onrender.com/health/version" | Select-Object StatusCode, Content

# SPA routes (check Content-Type header)
Invoke-WebRequest -Uri "https://do-intent.onrender.com/app" | Select-Object StatusCode, @{Name='ContentType';Expression={$_.Headers['Content-Type']}}
Invoke-WebRequest -Uri "https://do-intent.onrender.com/app/marketing" | Select-Object StatusCode, @{Name='ContentType';Expression={$_.Headers['Content-Type']}}
```

### Expected Results Summary

- `/healthz`: 200, `{"ok":true}`
- `/api/v1/ready`: 200, JSON with service status
- `/health/version`: 200, `{"gitSha":"<sha>","buildTime":"<timestamp>"}` (gitSha should not be "unknown" on Render)
- `/app`: 200, `Content-Type: text/html; charset=utf-8`
- `/app/marketing`: 200, `Content-Type: text/html; charset=utf-8`
