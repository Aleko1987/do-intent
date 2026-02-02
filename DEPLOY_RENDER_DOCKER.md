# Deploying to Render with Docker Image

This document describes how to deploy the backend to Render using a Docker image built by Encore and pushed to GitHub Container Registry (GHCR).

## Prerequisites

1. The GitHub Actions workflow (`.github/workflows/encore-docker.yml`) must have successfully built and pushed the Docker image to GHCR
2. You need access to the Render dashboard
3. You need a Render Postgres database instance (or connection details)

## Deployment Steps

### 1. Enable GHCR Package Visibility (if needed)

If this is the first time using GHCR for this repository:

1. Go to your GitHub repository
2. Navigate to **Packages** (right sidebar or `https://github.com/<OWNER>/do-intent/pkgs/container/do-intent`)
3. If the package is private, you may need to:
   - Make it public, OR
   - Configure Render to authenticate with GHCR (see Render docs for private registry auth)

### 2. Create Render Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Select **Deploy an existing image**
4. Enter the image URL:
   ```
   ghcr.io/<YOUR_GITHUB_USERNAME>/do-intent:latest
   ```
   Replace `<YOUR_GITHUB_USERNAME>` with your actual GitHub username or organization name.

### 3. Configure Service Settings

- **Name**: `do-intent` (or your preferred name)
- **Region**: Choose your preferred region
- **Branch**: Not applicable for image deployments
- **Instance Type**: Select based on your needs (Free tier available)

### Entrypoint Reminder (do-intent-web)

`do-intent-web` should run the Docker image built by Encore (from `backend/`). The image already includes the correct entrypoint for the backend service graph, so do **not** set a custom start command or point it at a frontend server. If you see `/track` 404s, double-check that the Render service is using the GHCR image and not the deprecated `render.yaml` Node start command.

### 4. Set Environment Variables

Add the following environment variables in the Render dashboard:

#### Required Variables

- `DATABASE_URL` - Full PostgreSQL connection string from your Render Postgres database
  - Format: `postgresql://user:password@host:port/database`
  - You can find this in your Render Postgres service dashboard

- `ENABLE_DB` - Set to `true` to enable `/track` writes to Postgres

- `CLERK_SECRET_KEY` - Your Clerk secret key for authentication

- `INGEST_API_KEY` - API key for website ingestion endpoints

- `NODE_ENV` - Set to `production`

- `PORT` - Render automatically sets this, but you can explicitly set it if needed (default: `10000`)

#### Optional Variables

- `ALLOWED_INGEST_ORIGINS` - Comma-separated list of allowed origin hostnames for website ingestion endpoints
  - Example: `example.com,app.example.com`
  - If not set, all origins are allowed

#### Database Split Variables (if needed)

If you cannot use `DATABASE_URL`, the backend will fall back to component variables:

- `DATABASE_HOSTPORT` - Database host and port (e.g., `host:5432`)
- `DATABASE_USER` - Database username
- `DATABASE_PASSWORD` - Database password
- `DATABASE_NAME` - Database name

#### Intent Tracking Schema

If you are enabling `/track` writes and the intent tracking tables do not exist yet, run:

```bash
psql "$DATABASE_URL" -f docs/intent-tracking-schema.sql
```

### 5. Configure Health Check

- **Health Check Path**: Leave empty or set to `/` (Encore doesn't expose a specific health endpoint by default)
- **Health Check Timeout**: Default is fine

### 6. Deploy

1. Click **Create Web Service**
2. Render will pull the image from GHCR and start the container
3. Monitor the logs to ensure the service starts successfully
4. The service will be available at the URL provided by Render (e.g., `https://do-intent.onrender.com`)

## Updating the Deployment

When you push to the `main` branch:

1. GitHub Actions automatically builds a new Docker image
2. The image is tagged with the commit SHA and also as `latest`
3. Render will automatically pull the new `latest` image if auto-deploy is enabled
4. Alternatively, manually trigger a deploy from the Render dashboard

The workflow builds the frontend assets (`backend/frontend/dist`) before creating the Docker
image. If SPA routes return 500s, confirm the GitHub Actions workflow ran and completed
the `Build frontend assets for SPA` step.

## Troubleshooting

### Image Not Found

- Verify the image exists in GHCR: `https://github.com/<OWNER>/do-intent/pkgs/container/do-intent`
- Check that the GitHub Actions workflow completed successfully
- Ensure the image name matches exactly (case-sensitive)

### Database Connection Issues

- Verify `DATABASE_URL` is correctly formatted
- Check that your Render Postgres database is running
- Ensure the database allows connections from Render's IP ranges
- Check application logs in Render dashboard for connection errors

### Authentication Issues

- Verify `CLERK_SECRET_KEY` is set correctly
- Check that `INGEST_API_KEY` matches your expected value
- Review application logs for authentication errors

### Port Issues

- Render automatically sets the `PORT` environment variable
- Encore should listen on `0.0.0.0:$PORT`
- If you see port binding errors, check that the Docker image is configured to use the PORT env var

## Manual Deployment Trigger

To manually trigger a new deployment:

1. Go to your Render service dashboard
2. Click **Manual Deploy** → **Deploy latest image**
3. Or update the image tag to a specific commit SHA: `ghcr.io/<OWNER>/do-intent:<SHA>`
