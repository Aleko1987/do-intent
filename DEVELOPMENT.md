# Getting Started

This project consists of an Encore application. Follow the steps below to get the app running locally.

## Prerequisites

If this is your first time using Encore, you need to install the CLI that runs the local development environment. Use the appropriate command for your system:

- **macOS:** `brew install encoredev/tap/encore`
- **Linux:** `curl -L https://encore.dev/install.sh | bash`
- **Windows:** `iwr https://encore.dev/install.ps1 | iex`

You also need to have bun installed for package management. If you don't have bun installed, you can install it by running:

```bash
npm install -g bun
```

## Running the Application

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Start the Encore development server:
   ```bash
   encore run
   ```

The backend will be available at the URL shown in your terminal (typically `http://localhost:4000`).

### Database Configuration & Migrations

The backend reads Postgres settings from `DATABASE_URL` (recommended) or the `DATABASE_*` components. For local development, set:

```bash
export ENABLE_DB=true
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/do_intent"
```

If you point to a remote Postgres (Render/Encore/Neon), ensure SSL is enabled (the backend auto-enables `sslmode=require` for non-local hosts, but you can add it explicitly):

```bash
export DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

Apply SQL migrations to the actual database backing your environment (Render/Encore Postgres for production):

```bash
for file in backend/db/migrations/*.up.sql; do
  psql "$DATABASE_URL" -f "$file"
done
```



### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npx vite dev
   ```

The frontend will be available at `http://localhost:5173` (or the next available port).


### Generate Frontend Client
To generate the frontend client, run the following command in the `backend` directory:

```bash
encore gen client --target leap
```

## Deployment

### Self-hosting
See the [self-hosting instructions](https://encore.dev/docs/self-host/docker-build) for how to use encore build docker to create a Docker image and
configure it.

### Encore Cloud Platform

#### Step 1: Login to your Encore Cloud Account

Before deploying, ensure you have authenticated the Encore CLI with your Encore account (same as your Leap account)

```bash
encore auth login
```

#### Step 2: Set Up Git Remote

Add Encore's git remote to enable direct deployment:

```bash
git remote add encore encore://sales-crm-marketing-module-cia2
```

#### Step 3: Deploy Your Application

Deploy by pushing your code:

```bash
git add -A .
git commit -m "Deploy to Encore Cloud"
git push encore
```

Monitor your deployment progress in the [Encore Cloud dashboard](https://app.encore.dev/sales-crm-marketing-module-cia2/deploys).

## GitHub Integration (Recommended for Production)

For production applications, we recommend integrating with GitHub instead of using Encore's managed git:

### Connecting Your GitHub Account

1. Open your app in the **Encore Cloud dashboard**
2. Navigate to Encore Cloud [GitHub Integration settings](https://app.encore.cloud/sales-crm-marketing-module-cia2/settings/integrations/github)
3. Click **Connect Account to GitHub**
4. Grant access to your repository

Once connected, pushing to your GitHub repository will automatically trigger deployments. Encore Cloud Pro users also get Preview Environments for each pull request.

### Deploy via GitHub

After connecting GitHub, deploy by pushing to your repository:

```bash
git add -A .
git commit -m "Deploy via GitHub"
git push origin main
```

## Environment Variables

### Backend

#### Secrets (Required in Production)

- `IngestApiKey` (secret, **required in production**): API key for website intent event ingestion endpoints. Endpoints require `x-do-intent-key` header matching this value. In production, missing secret causes startup error. In development, endpoints are public if secret is not set.

To set the secret in Encore:
```bash
encore secret set --type dev IngestApiKey <your-api-key>
encore secret set --type prod IngestApiKey <your-api-key>
```

#### Environment Variables

- `ALLOWED_INGEST_ORIGINS` (optional): Comma-separated list of allowed origin hostnames for website ingestion endpoints. If set, requests must include `Origin` or `Referer` header with a matching hostname. Supports subdomain matching (e.g., `example.com` matches `app.example.com`). If not set, all origins are allowed.

Example:
```bash
export ALLOWED_INGEST_ORIGINS="example.com,app.example.com,localhost"
```

## Website Integration Flow

The website ingestion follows an **identify-first** pattern:

1. **Identify** (`POST /marketing/identify`): Call with `email` and `anonymous_id` to get or create a lead. Returns `lead_id`.
2. **Ingest Events** (`POST /marketing/ingest-intent-event`): Call with `lead_id` (required) to track intent events.

Example flow:
```bash
# Step 1: Identify user (get lead_id)
curl -X POST http://localhost:4000/marketing/identify \
  -H "Content-Type: application/json" \
  -H "x-do-intent-key: your-api-key" \
  -H "Origin: https://example.com" \
  -d '{
    "anonymous_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "company_name": "Acme Corp"
  }'
# Response: { "lead_id": "...", "lead_created": true }

# Step 2: Ingest events with lead_id
curl -X POST http://localhost:4000/marketing/ingest-intent-event \
  -H "Content-Type: application/json" \
  -H "x-do-intent-key: your-api-key" \
  -H "Origin: https://example.com" \
  -d '{
    "event_type": "page_view",
    "lead_id": "<lead_id from identify>",
    "url": "https://example.com/pricing",
    "metadata": { "page_title": "Pricing" }
  }'
```

## Additional Resources

- [Encore Documentation](https://encore.dev/docs)
- [Deployment Guide](https://encore.dev/docs/platform/deploy/deploying)
- [GitHub Integration](https://encore.dev/docs/platform/integrations/github)
- [Encore Cloud Dashboard](https://app.encore.dev)

## Verification (Ingest + Events)

```bash
BASE_URL="http://localhost:4000"
INGEST_API_KEY="your-api-key"

curl "$BASE_URL/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-ingest-api-key: $INGEST_API_KEY" \
  -d '{
    "event_type": "page_view",
    "event_source": "website",
    "anonymous_id": "anon-dev-smoke",
    "dedupe_key": "dev_smoke_1",
    "occurred_at": "2024-01-01T00:00:00.000Z",
    "metadata": { "page": "pricing" }
  }'

curl "$BASE_URL/api/v1/events?dedupe_key=dev_smoke_1&limit=5"
# Expect: count >= 1 and items[0].dedupe_key == "dev_smoke_1" (non-null)
```

## PowerShell Smoke Test (Ingest + Events)

```powershell
$BASE_URL = "http://localhost:4000"
$INGEST_API_KEY = "your-api-key"

# 1) Health check
curl "$BASE_URL/healthz"

# 2) Ingest an intent event
curl "$BASE_URL/api/v1/ingest" `
  -H "Content-Type: application/json" `
  -H "x-ingest-api-key: $INGEST_API_KEY" `
  -d '{
    "event_type": "page_view",
    "event_source": "website",
    "anonymous_id": "anon-ps-smoke",
    "dedupe_key": "ps_smoke_1",
    "occurred_at": "2024-01-01T00:00:00.000Z",
    "metadata": { "page": "pricing" }
  }'

# 3) Read events back
curl "$BASE_URL/api/v1/events?dedupe_key=ps_smoke_1&limit=5"
# Expect: count >= 1 and items[0].dedupe_key == "ps_smoke_1" (non-null)
```
