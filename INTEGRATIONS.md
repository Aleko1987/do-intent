# DO Intent Website Integration

This document describes how to integrate DO Intent tracking into a marketing website (e.g., Earthcure website).

## Overview

DO Intent uses an **identify-first** flow:
1. Call `identifyLead()` when you have an email (e.g., on contact form submit)
2. Store `lead_id` in localStorage (done automatically)
3. Call `trackEvent()` with `lead_id` for all subsequent events

## Setup

### 1. Environment Variables

Create a `.env` file in your `frontend` directory with the following variables:

```bash
# Base URL for DO Intent API
VITE_DO_INTENT_BASE_URL=https://your-api-url.com
# Or for local dev: http://localhost:4000

# API key (required in production)
VITE_DO_INTENT_KEY=your-api-key-here
```

**Note:** A `.env.example` file is provided in the `frontend` directory (do not commit `.env` to git). Copy it to `.env` and fill in your values:
```bash
cp frontend/.env.example frontend/.env
```

**For Netlify deployment:**
1. Go to Site settings → Environment variables
2. Add `VITE_DO_INTENT_BASE_URL` and `VITE_DO_INTENT_KEY`
3. Redeploy your site

### 2. Import the Client Library

```typescript
import { identifyLead, trackEvent, getLeadId } from '@/lib/doIntent';
```

## Integration Examples

### Contact Form (Identify-First Flow)

```typescript
import { identifyLead, trackEvent } from '@/lib/doIntent';

async function handleContactSubmit(email: string, company?: string, name?: string) {
  try {
    // Step 1: Identify the lead
    const { lead_id } = await identifyLead(email, company, name);
    
    // Step 2: Track form submission
    await trackEvent(lead_id, 'form_submit', {
      form: 'contact'
    });
    
    // Show success message
  } catch (error) {
    console.error('DO Intent tracking failed:', error);
    // Don't block form submission if tracking fails
  }
}
```

### Form Start Tracking (Optional)

Track when user starts filling the form (only if lead_id exists):

```typescript
import { getLeadId, trackEvent } from '@/lib/doIntent';

function handleInputFocus() {
  const leadId = getLeadId();
  if (leadId) {
    trackEvent(leadId, 'form_start', { form: 'contact' }).catch(console.error);
  }
}
```

### High-Intent Page Tracking

Track page views for pricing, contact, and case study pages (only if lead_id exists):

```typescript
import { useEffect } from 'react';
import { getLeadId, trackEvent } from '@/lib/doIntent';

// Pricing Page
export default function PricingPage() {
  useEffect(() => {
    const leadId = getLeadId();
    if (leadId) {
      trackEvent(leadId, 'pricing_view').catch(console.error);
    }
  }, []);
  
  // ... rest of component
}

// Contact Page
export default function ContactPage() {
  useEffect(() => {
    const leadId = getLeadId();
    if (leadId) {
      trackEvent(leadId, 'contact_view').catch(console.error);
    }
  }, []);
  
  // ... rest of component
}

// Case Study Page
export default function CaseStudyPage({ slug, title }: { slug: string; title: string }) {
  useEffect(() => {
    const leadId = getLeadId();
    if (leadId) {
      trackEvent(leadId, 'case_study_view', {
        slug,
        title
      }).catch(console.error);
    }
  }, [slug, title]);
  
  // ... rest of component
}
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
- Includes API key header if `VITE_DO_INTENT_KEY` is set

### `trackEvent(lead_id: string, event_type: string, metadata?: Record<string, any>): Promise<{ event_id: string; lead_id: string; scored: boolean }>`
Tracks an intent event.
- Requires `lead_id` from `identifyLead()`
- Automatically includes: URL, path, referrer, UTM parameters
- Metadata is normalized (drops keys with values > 500 chars)
- Valid event types: `form_submit`, `form_start`, `pricing_view`, `contact_view`, `case_study_view`, `page_view`, `link_click`, `identify`

## Implementation Status

The following pages have been integrated with DO Intent tracking:

- **Contact Page** (`/contact`): 
  - Identifies lead on form submit
  - Tracks `form_submit` event
  - Tracks `form_start` when user focuses input (if lead_id exists)
  - Tracks `contact_view` on page load (if lead_id exists)

- **Pricing Page** (`/pricing`):
  - Tracks `pricing_view` on page load (if lead_id exists)

- **Case Study Pages** (`/case-study/:slug`):
  - Tracks `case_study_view` with slug and title metadata (if lead_id exists)

## Testing

### Local Development

1. Copy `.env.example` to `.env` in the `frontend` directory
2. Set `VITE_DO_INTENT_BASE_URL=http://localhost:4000` (or your local backend URL)
3. Optionally set `VITE_DO_INTENT_KEY` if your local backend requires it
4. Start the frontend: `cd frontend && npm run dev`
5. Test the integration:
   - Visit `/contact` and submit the form → should call `/marketing/identify`
   - After submitting, visit `/pricing` → should call `/marketing/ingest-intent-event` with `pricing_view`
   - Visit `/case-study/acme-corp` → should call `/marketing/ingest-intent-event` with `case_study_view`
   - Check browser DevTools Network tab to verify requests

### Production

1. Ensure `VITE_DO_INTENT_BASE_URL` points to your production API
2. Set `VITE_DO_INTENT_KEY` (required in production)
3. Verify in browser DevTools Network tab that requests are being made
4. Check DO Intent dashboard to see leads and events

## Error Handling

The library throws errors if:
- Environment variables are missing
- API requests fail
- Invalid parameters are provided

**Best practice:** Wrap tracking calls in try/catch and don't block user actions if tracking fails:

```typescript
try {
  await trackEvent(leadId, 'pricing_view');
} catch (error) {
  console.error('Tracking failed:', error);
  // Continue with page load
}
```

## Notes

- **Metadata size limit:** Metadata values > 500 chars are automatically dropped
- **UTM tracking:** UTM parameters from URL are automatically included in events
- **Referrer tracking:** Document referrer is automatically captured
- **Anonymous ID:** Generated once per browser and stored in localStorage
- **Lead ID:** Stored in localStorage after successful `identifyLead()` call

