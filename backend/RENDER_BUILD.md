# Render Build Instructions

## Build Command

The build process must run from the `backend` directory:

```bash
cd backend && npm ci && npm run build
```

This will:
1. Install dependencies using `npm ci` (uses lockfile for reproducible builds)
2. Build the frontend using Vite, outputting to `backend/frontend/dist`

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

## Notes

- The build script uses `npm ci` instead of `bun install` for compatibility with Render's Node.js runtime
- The frontend is built using Vite with output directory `../backend/frontend/dist`
- The `--emptyOutDir` flag ensures a clean build each time

