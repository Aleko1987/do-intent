# Render Path Debugging - Summary

## Changes Made

### 1. Added Health Endpoint to intent_scorer Service
- **File**: `backend/intent_scorer/health.ts`
- **Path**: `GET /health`
- **Purpose**: Health check endpoint guaranteed to be in deployed service graph
- **No DB dependency**: Returns simple JSON response

### 1.1 Added Healthz Service Endpoint
- **File**: `backend/health/health.ts`
- **Path**: `GET /healthz`
- **Purpose**: Dedicated public health check endpoint for Render/Cloudflare routing
- **No DB dependency**: Returns simple JSON response

### 2. Added Ping Endpoint to intent_scorer Service  
- **File**: `backend/intent_scorer/ping.ts`
- **Path**: `GET /intent-scorer/ping`
- **Purpose**: Non-DB endpoint for testing intent_scorer service availability
- **No DB dependency**: Returns simple JSON response

### 3. Existing Endpoints
- **listRules**: `GET /intent-scorer/rules` (requires DB, will fail with "DB disabled" error)
- **health** (old): `GET /health` in frontend service (may not be in deployed graph)

## Next Steps to Verify

### A) Check Deployed Commit SHA
1. In Render Dashboard → `do-intent-web` service → Events/Deployments
2. Look for "Checking out commit..." log line
3. Compare with local HEAD commit (expected: `816bf75`)
4. If different, ensure service tracks `main` branch and redeploy

### B) Determine Actual Public HTTP Paths
Based on Render logs showing `endpoint="listRules"` but 404 on `/intent-scorer/rules`:

**Possible scenarios:**
1. **Path prefix**: Encore might be mounted at `/api` or another prefix
   - Try: `https://do-intent-web.onrender.com/api/intent-scorer/rules`
   - Try: `https://do-intent-web.onrender.com/api/health`

2. **Service path mapping**: Encore might use service name as prefix
   - Try: `https://do-intent-web.onrender.com/intent_scorer/rules` (underscore)
   - Try: `https://do-intent-web.onrender.com/intent_scorer/health`

3. **Gateway routing**: Check if Gateway requires different path format
   - Review Render logs for actual HTTP request paths
   - Look for any path transformation in gateway configuration

### C) Test New Endpoints
Once correct base path is determined, test:
- `GET {base_path}/health` - Should return `{"ok":true,"service":"do-intent","ts":"..."}`
- `GET {base_path}/intent-scorer/ping` - Should return `{"ok":true,"service":"intent_scorer","ts":"..."}`
- `GET {base_path}/intent-scorer/rules` - Will fail with DB error (expected)

## Deliverables Status

### ✅ 1. Deployed SHA
- **Action Required**: Check Render Dashboard for deployed commit SHA
- **Expected**: Should match `816bf75` (local HEAD)
- **If Different**: Redeploy from `main` branch

### ⏳ 2. Correct Public URL Paths
- **Status**: Pending verification from Render logs
- **Action Required**: 
  - Check Render logs for actual HTTP request paths
  - Test with `/api` prefix
  - Test with service name variations
- **Once Confirmed**: Update this document with correct paths

### ✅ 3. Minimal Patch Applied
- **Health Endpoint**: Added to `intent_scorer` service at `/health` (no DB)
- **Ping Endpoint**: Added to `intent_scorer` service at `/intent-scorer/ping` (no DB)
- **listRules**: Existing endpoint at `/intent-scorer/rules` (requires DB, will fail as expected)

## Notes

- The health endpoint was moved from `frontend` service to `intent_scorer` to ensure it's in the deployed service graph
- Both new endpoints (`/health` and `/intent-scorer/ping`) have no database dependencies
- Encore's internal logging already shows `endpoint="listRules"`, confirming the service is handling requests
- The 404 errors suggest a path prefix or routing issue, not a service availability issue
