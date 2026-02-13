# DO-Intent Website Tracker

A lightweight, framework-agnostic JavaScript tracker for capturing user intent signals on any website.

## Overview

The DO-Intent tracker automatically captures behavioral signals (page views, scroll depth, time on page, CTA clicks) and sends them to the `/track` endpoint. It also provides an `identify()` function to link anonymous browsing history to known identities when emails are captured.

## Installation

### Option 1: Plain JavaScript Snippet (Any Website)

Copy the snippet from `docs/snippets/website-tracker.js` and paste it into your HTML page before the closing `</body>` tag:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
</head>
<body>
  <!-- Your content -->
  
  <!-- DO-Intent Tracker -->
  <script>
    // Configure API base URL (or leave empty for same-origin)
    window.DO_INTENT_API_BASE = 'https://api.example.com';
    window.DO_INTENT_DEBUG = false; // Set to 'true' for console logging
  </script>
  <script src="path/to/website-tracker.js"></script>
  <!-- Or paste the entire snippet inline -->
</body>
</html>
```

### Option 2: ES Module (React/Vue/etc.)

Install the tracker module:

```typescript
import { init, track, identify } from '@/lib/doIntentTracker';

// Initialize once (e.g., in your app entry point)
init({
  apiBase: import.meta.env.VITE_API_BASE_URL || '',
  debug: false,
  useCookies: true, // optional: first-party cookie storage fallback
});

// Track custom events
track('custom_event', { 
  value: 100,
  metadata: { custom_field: 'value' }
});

// Identify user (on form submit)
identify('user@example.com', 'John Doe')
  .then(result => {
    console.log('Identity ID:', result.identity_id);
    console.log('Score:', result.total_identity_score);
  });
```

## Configuration

### Environment Variables

For module-based installations, set:

```bash
VITE_API_BASE_URL=https://api.example.com
```

If `apiBase` is empty or not set, the tracker defaults to same-origin (useful when running through Encore gateway).

### API Base URL

- **Production**: Set to your deployed API URL (e.g., `https://api.example.com`)
- **Development**: Leave empty for same-origin, or use `http://localhost:4000`
- **Encore Gateway**: Leave empty to use same-origin routing

### Debug Mode

Enable debug logging to see events in the browser console:

```javascript
// Plain JS
window.DO_INTENT_DEBUG = 'true';

// Module
init({ debug: true });
```

### Storage Mode (`useCookies`)

Tracker storage defaults to browser storage, but you can force first-party cookie mode:

```typescript
init({
  apiBase: '',
  useCookies: true,
});
```

- `useCookies: false` (default): uses `localStorage`/`sessionStorage` when available
- `useCookies: true`: uses first-party cookies (`SameSite=Lax`) for IDs/timestamps
- automatic fallback: if storage APIs are unavailable, tracker falls back to cookies

## Automatic Events

The tracker automatically emits these events:

### 1. `page_view`
- **When**: On every page load
- **Payload**: URL, referrer, device, user agent, timezone, `page_class`, UTM params, click IDs (`gclid`, `fbclid`, `msclkid`)

### 2. `scroll_depth`
- **When**: User scrolls past 60% of page (fires once per page)
- **Payload**: `value: 60-100` (scroll percentage)

### 3. `time_on_page`
- **When**: User stays on page for 30+ seconds (fires once per page)
- **Payload**: `value: 30` (seconds)

### 4. `click`
- **When**: User clicks a CTA element
- **CTA Detection**: Element is considered a CTA if:
  - Has `data-intent-cta="true"` attribute
  - Is a link with href containing `/pricing` or `/contact`
  - Has a class containing "cta" (case-insensitive)
- **Payload**: CTA element info (tag, text, href)

## Manual Tracking

### Track Custom Events

```javascript
// Plain JS
window.DOIntent.track('custom_event', {
  value: 100,
  metadata: { custom_field: 'value' }
});

// Module
track('custom_event', {
  value: 100,
  metadata: { custom_field: 'value' }
});
```

### Identify User (Form Submit)

Call `identify()` when you capture an email address:

```javascript
// Plain JS
window.DOIntent.identify('user@example.com', 'John Doe')
  .then(function(result) {
    console.log('Identity ID:', result.identity_id);
    console.log('Merged Score:', result.total_identity_score);
    console.log('Band:', result.band); // 'cold' | 'warm' | 'hot' | 'critical'
  })
  .catch(function(error) {
    console.error('Identify failed:', error);
  });

// Module
try {
  const result = await identify('user@example.com', 'John Doe');
  console.log('Identity ID:', result.identity_id);
} catch (error) {
  console.error('Identify failed:', error);
}
```

**Important**: Do NOT automatically call `identify()` on form focus or input. Only call it when you have a confirmed email (e.g., on successful form submit).

## Integration Examples

### Contact Form (React)

```typescript
import { identify } from '@/lib/doIntentTracker';

function ContactForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = e.target.email.value;
    const name = e.target.name.value;
    
    try {
      // Identify user
      const result = await identify(email, name);
      console.log('User identified:', result.identity_id);
      
      // Submit form (your existing logic)
      await submitForm({ email, name });
    } catch (error) {
      console.error('Tracking failed:', error);
      // Don't block form submission
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="name" type="text" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Contact Form (Plain HTML)

```html
<form id="contact-form">
  <input type="email" id="email" required />
  <input type="text" id="name" />
  <button type="submit">Submit</button>
</form>

<script>
document.getElementById('contact-form').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const name = document.getElementById('name').value;
  
  // Identify user
  window.DOIntent.identify(email, name)
    .then(function(result) {
      console.log('User identified:', result.identity_id);
      
      // Submit form (your existing logic)
      // submitForm({ email, name });
    })
    .catch(function(error) {
      console.error('Tracking failed:', error);
      // Don't block form submission
    });
});
</script>
```

### Mark CTAs Explicitly

Add `data-intent-cta="true"` to any element you want to track as a CTA:

```html
<a href="/pricing" data-intent-cta="true">View Pricing</a>
<button class="cta-button" data-intent-cta="true">Get Started</button>
```

## Event Payload Structure

All events sent to `/track` include:

```json
{
  "event": "page_view",
  "session_id": "uuid",
  "anonymous_id": "uuid",
  "url": "/pricing",
  "referrer": "https://google.com",
  "timestamp": 1700000000,
  "value": 60,
  "metadata": {
    "device": "mobile",
    "user_agent": "Mozilla/5.0...",
    "timezone": "America/New_York",
    "referrer": "https://google.com",
    "page_title": "Pricing - My Site",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "spring_sale",
    "gclid": "EAIaIQob...",
    "fbclid": "IwAR...",
    "msclkid": "123abc...",
    "page_class": "pricing"
  }
}
```

## Storage

The tracker stores identifiers in browser storage by default (with cookie support/fallback):

- **Anonymous ID**
  - `localStorage`: `do_intent_anonymous_id` (persistent UUID), or
  - cookie: `do_intent_anonymous_id` (`Max-Age=365d`) when `useCookies=true` or storage unavailable
- **Session ID**
  - `sessionStorage`: `do_intent_session_id` (UUID), or
  - cookie: `do_intent_session_id` (`Max-Age=1d`) in cookie mode
- **Session activity timestamp**
  - `sessionStorage`: `do_intent_session_ts`, or
  - cookie: `do_intent_session_ts`

### Session rotation timeout

- Session rotates after **30 minutes of inactivity**.
- Inactivity is measured by comparing current time to `do_intent_session_ts`.
- On activity, timestamp is refreshed.

## Testing Checklist

Manual testing steps:

1. **Page View**
   - Load page → Check network tab for `POST /track` with `event: "page_view"`

2. **Scroll Depth**
   - Scroll past 60% → Check for `event: "scroll_depth"` with `value: 60-100` (fires once)

3. **Time on Page**
   - Wait 30 seconds → Check for `event: "time_on_page"` with `value: 30` (fires once)

4. **CTA Click**
   - Click element with `data-intent-cta="true"` → Check for `event: "click"` with CTA metadata

5. **Identify**
   - Call `identify(email)` → Check for `POST /api/v1/identify` → Verify response includes `identity_id` and `total_identity_score`

6. **Click IDs**
   - Open URL with `?gclid=...&fbclid=...&msclkid=...`
   - Check `POST /track` payload metadata includes all present click IDs

7. **Session Timeout**
   - Trigger an event, wait >30 minutes (or manually backdate `do_intent_session_ts`), trigger another event
   - Verify a new `session_id` is sent

## Troubleshooting

### Events Not Sending

1. Check browser console for errors
2. Enable debug mode: `window.DO_INTENT_DEBUG = 'true'`
3. Verify API base URL is correct
4. Check network tab for failed requests

### Identify Not Working

1. Ensure email is valid format
2. Check that `anonymous_id` exists in localStorage
3. Verify API endpoint is accessible
4. Check response for error messages

### CTA Clicks Not Detected

1. Add `data-intent-cta="true"` explicitly
2. Check element href contains `/pricing` or `/contact`
3. Verify element has class containing "cta"
4. Check browser console for click handler errors

## External Site Integration (Custom Domain)

Use this when your marketing site is hosted outside this app domain (for example WordPress/Webflow at a custom domain).

### 1) Configure backend allowlist + key

Set env vars on backend deploy:

- `ALLOWED_INGEST_ORIGINS=earthcurebiodiesel.com,www.earthcurebiodiesel.com`
- `INGEST_API_KEY=<strong-random-secret>` (or `ENCORE_SECRET_INGEST_API_KEY`)

Then redeploy.

### 2) Add tracker script to website

On your external site:

```html
<script>
  window.DO_INTENT_API_BASE = 'https://do-intent.onrender.com';
  window.DO_INTENT_DEBUG = 'true'; // set 'false' after testing
</script>
<!-- paste docs/snippets/website-tracker.js inline or host and include it -->
```

### 3) Wire form submit to identify + lead ingest

On confirmed email submit:

1. Call anonymous identity merge endpoint (`/api/v1/identify`) to connect browsing history.
2. Call marketing identify endpoint (`/marketing/identify`) to create/find a lead.
3. Send lead event to `/marketing/ingest-intent-event`.

Example payload fields to include in lead ingest:
- `lead_id`, `event_type`, `event_source`, `url`, `path`, `referrer`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
- `gclid`, `fbclid`, `msclkid`

### 4) Security note (recommended)

Do not permanently expose ingest keys in public client JS. For production:

- send lead ingest through a server-side proxy (Cloudflare Worker/serverless route),
- inject `x-ingest-api-key` and `x-do-intent-key` server-side,
- keep browser code keyless.

### 5) Verify data lands in app

- Open `https://do-intent.onrender.com/app/marketing` and check for new leads/events.
- Check `Intent Signals` tab for scored activity.
- Confirm attribution and click IDs appear in event metadata.

## Privacy & Compliance

- First-party storage only: localStorage/sessionStorage by default; optional first-party cookies (`useCookies=true` or storage fallback)
- No third-party analytics libraries
- All data sent to your own API endpoint
- Complies with GDPR (no automatic PII collection)

## Support

For issues or questions, see:
- Architecture: `/docs/ARCHITECTURE.md`
- Codex: `/docs/CODEX.md`
- Backend endpoints: `backend/intent_scorer/track.ts`, `backend/intent_scorer/identify.ts`
