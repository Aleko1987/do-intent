# DO Intent Website Integration

This document describes two supported integration paths:
1) **Lead-based ingestion** via `/marketing/identify` + `/marketing/ingest-intent-event`
2) **Anonymous-first tracking** via `/track` + optional `/api/v1/identify`

## Overview

### Lead-Based Flow (Marketing)
1. Call `identifyLead()` when you have an email (e.g., on contact form submit)
2. Store `lead_id` in localStorage (done automatically)
3. Call `trackEvent()` with `lead_id` for subsequent events

### Anonymous-First Flow (Website Tracker)
1. Call `init()` from `doIntentTracker`
2. Auto-tracks `page_view`, `scroll_depth`, and `time_on_page`
3. Call `identify()` when you capture an email to promote anonymous activity

## Setup

### 1. Environment Variables

Create a `.env` file in your `frontend` directory:

```bash
# Lead-based client (doIntent.ts)
VITE_DO_INTENT_BASE_URL=https://your-api-url.com
VITE_DO_INTENT_KEY=your-identify-api-key

# Anonymous tracker (doIntentTracker.ts)
VITE_API_BASE_URL=https://your-api-url.com
```

**Note:** A `.env.example` file is provided in the `frontend` directory (do not commit `.env` to git). Copy it to `.env` and fill in your values:
```bash
cp frontend/.env.example frontend/.env
```

**For Netlify deployment:**
1. Go to Site settings → Environment variables
2. Add `VITE_DO_INTENT_BASE_URL`, `VITE_DO_INTENT_KEY`, and `VITE_API_BASE_URL`
3. Redeploy your site

### 2. Import the Client Libraries

```typescript
import { identifyLead, trackEvent, getLeadId } from '@/lib/doIntent';
import { init, track, identify } from '@/lib/doIntentTracker';
```

## Integration Examples

### Contact Form (Lead-Based Identify + Track)

```typescript
import { identifyLead, trackEvent } from '@/lib/doIntent';
import { identify as identifyIntent } from '@/lib/doIntentTracker';

async function handleContactSubmit(email: string, company?: string, name?: string) {
  try {
    // Optional: promote anonymous tracking identity
    await identifyIntent(email, name);

    // Step 1: Identify the lead (marketing endpoint)
    const { lead_id } = await identifyLead(email, company, name);
    
    // Step 2: Track form submission
    await trackEvent(lead_id, 'form_submit', {
      form: 'contact'
    });
  } catch (error) {
    console.error('DO Intent tracking failed:', error);
  }
}
```

### Form Start Tracking (Optional)

```typescript
import { getLeadId, trackEvent } from '@/lib/doIntent';

function handleInputFocus() {
  const leadId = getLeadId();
  if (leadId) {
    trackEvent(leadId, 'form_start', { form: 'contact' }).catch(console.error);
  }
}
```

### Anonymous Tracker (Auto + Custom Events)

```typescript
import { init, track } from '@/lib/doIntentTracker';

init({ apiBase: 'https://your-api-url.com', debug: false });

// Track a custom event
track('click', { metadata: { cta_text: 'Get Started' } });
```

## API Reference

### `getAnonId(): string`
Returns or creates an anonymous ID (UUID) stored in localStorage.

### `getLeadId(): string | null`
Returns the stored `lead_id` from localStorage, or `null` if not identified yet.

### `identifyLead(email: string, company_name?: string, contact_name?: string): Promise<{ lead_id: string; lead_created: boolean }>`
Identifies a lead by email. Creates a new lead if not found, or returns existing lead.
- Automatically stores `lead_id` in localStorage
- Requires `VITE_DO_INTENT_BASE_URL` to be set
- Uses `x-do-intent-key` when `VITE_DO_INTENT_KEY` is set

### `trackEvent(lead_id: string, event_type: string, metadata?: Record<string, any>): Promise<{ event_id: string; lead_id: string; scored: boolean }>`
Tracks an intent event.
- Requires `lead_id` from `identifyLead()`
- Automatically includes: URL, path, referrer, UTM parameters
- Metadata is normalized (drops keys with values > 500 chars)
- Valid event types (ingest): `page_view`, `pricing_view`, `contact_view`, `case_study_view`, `form_start`, `form_submit`, `link_click`, `identify`
- **Note:** In production, `/marketing/ingest-intent-event` requires `x-ingest-api-key` (see Notes)

### `init(options?: { apiBase?: string; debug?: boolean }): void`
Initializes the anonymous tracker. If `apiBase` is omitted it uses `VITE_API_BASE_URL` or falls back to `http://localhost:4000` in dev.

### `track(eventType: string, payload?: { value?: number; metadata?: Record<string, any> }): void`
Sends an anonymous event to `/track`.
- Event types from the tracker: `page_view`, `time_on_page`, `scroll_depth`, `click`, `form_start`, `form_submit`

### `identify(email: string, name?: string): Promise<{ identity_id: string; merged: boolean; total_identity_score: number; band: string }>`
Promotes anonymous browsing history to a known identity via `/api/v1/identify`.

## Implementation Status

The following pages are integrated:

- **Contact Page** (`/contact`): 
  - Calls anonymous `identify()` and lead `identifyLead()` on submit
  - Tracks `form_submit` and `form_start`
  - Tracks `contact_view` on load (lead-based)

- **Pricing Page** (`/pricing`):
  - Tracks `pricing_view` on load (lead-based)

- **Case Study Pages** (`/case-study/:slug`):
  - Tracks `case_study_view` with slug/title metadata (lead-based)

## Testing

### Local Development

1. Copy `.env.example` to `.env` in `frontend`
2. Set `VITE_DO_INTENT_BASE_URL=http://localhost:4000`
3. Set `VITE_API_BASE_URL=http://localhost:4000`
4. Optionally set `VITE_DO_INTENT_KEY`
5. Start the frontend: `cd frontend && npm run dev`
6. Verify:
   - Submit `/contact` → `/marketing/identify` + `/marketing/ingest-intent-event`
   - Visit `/pricing` → `/marketing/ingest-intent-event` with `pricing_view`
   - Visit `/case-study/acme-corp` → `/marketing/ingest-intent-event` with `case_study_view`
   - Page loads fire `/track` for anonymous tracking

### Production

1. Ensure `VITE_DO_INTENT_BASE_URL` and `VITE_API_BASE_URL` point to production
2. Set `VITE_DO_INTENT_KEY` (for `/marketing/identify`)
3. Confirm ingest auth headers are correct (see Notes)
4. Verify requests in DevTools → Network

## Error Handling

The libraries throw errors if:
- Environment variables are missing
- API requests fail
- Invalid parameters are provided

**Best practice:** Wrap tracking calls in try/catch and don't block user actions if tracking fails.

## Notes

- **Metadata size limit (lead-based):** Values > 500 chars are dropped in `doIntent.ts`
- **Anonymous tracker storage:** `anonymous_id` in localStorage, `session_id` in sessionStorage
- **Ingest auth header:** `/marketing/ingest-intent-event` and `/api/v1/ingest` require `x-ingest-api-key` in production
  - If you use `doIntent.ts`, update the header to `x-ingest-api-key` or add a custom fetch for ingest

