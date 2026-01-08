/**
 * DO Intent Client Integration
 * 
 * Identify-first flow for tracking marketing intent events.
 * 
 * Usage:
 * 1. Call identifyLead() when you have an email (e.g., on form submit)
 * 2. Store lead_id in localStorage (done automatically)
 * 3. Call trackEvent() with lead_id for all subsequent events
 */

const STORAGE_KEY_LEAD_ID = "do_intent_lead_id";
const STORAGE_KEY_ANON_ID = "do_intent_anon_id";

/**
 * Get or create anonymous ID (UUID stored in localStorage)
 */
export function getAnonId(): string {
  let anonId = localStorage.getItem(STORAGE_KEY_ANON_ID);
  if (!anonId) {
    // Generate a simple UUID v4
    anonId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem(STORAGE_KEY_ANON_ID, anonId);
  }
  return anonId;
}

/**
 * Get stored lead_id from localStorage
 */
export function getLeadId(): string | null {
  return localStorage.getItem(STORAGE_KEY_LEAD_ID);
}

/**
 * Extract UTM parameters from URL
 */
function getUtmParams(): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
} {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  }
  return utm;
}

/**
 * Normalize metadata to prevent oversized payloads
 * Drops keys with values > 500 chars
 */
function normalizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const strValue = typeof value === "string" ? value : JSON.stringify(value);
    if (strValue.length <= 500) {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Identify a lead by email (find-or-create)
 * Stores lead_id in localStorage on success
 * 
 * @param email - Required email address
 * @param company_name - Optional company name
 * @param contact_name - Optional contact name
 * @returns Promise with lead_id and lead_created flag
 */
export async function identifyLead(
  email: string,
  company_name?: string,
  contact_name?: string
): Promise<{ lead_id: string; lead_created: boolean }> {
  const baseUrl = import.meta.env.VITE_DO_INTENT_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_DO_INTENT_BASE_URL is not set");
  }

  const apiKey = import.meta.env.VITE_DO_INTENT_KEY;
  const anonId = getAnonId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Include API key in production (or if set in dev)
  if (apiKey) {
    headers["x-do-intent-key"] = apiKey;
  }

  const body = {
    anonymous_id: anonId,
    email: email.trim().toLowerCase(),
    ...(company_name && { company_name: company_name.trim() }),
    ...(contact_name && { contact_name: contact_name.trim() }),
  };

  const response = await fetch(`${baseUrl}/marketing/identify`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Identify failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Store lead_id in localStorage
  if (data.lead_id) {
    localStorage.setItem(STORAGE_KEY_LEAD_ID, data.lead_id);
  }

  return data;
}

/**
 * Track an intent event (requires lead_id from identifyLead)
 * 
 * @param lead_id - Lead ID from identifyLead (or getLeadId())
 * @param event_type - Event type (e.g., "form_submit", "pricing_view", "contact_view")
 * @param metadata - Optional metadata object (will be normalized)
 */
export async function trackEvent(
  lead_id: string,
  event_type: string,
  metadata?: Record<string, any>
): Promise<{ event_id: string; lead_id: string; scored: boolean }> {
  const baseUrl = import.meta.env.VITE_DO_INTENT_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_DO_INTENT_BASE_URL is not set");
  }

  const apiKey = import.meta.env.VITE_DO_INTENT_KEY;
  const anonId = getAnonId();
  const utm = getUtmParams();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Include API key in production (or if set in dev)
  if (apiKey) {
    headers["x-do-intent-key"] = apiKey;
  }

  // Build metadata with URL, path, referrer, UTM params
  const eventMetadata: Record<string, any> = {
    ...normalizeMetadata(metadata || {}),
    anonymous_id: anonId,
    url: window.location.href,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    ...utm,
  };

  const body = {
    lead_id,
    event_type,
    event_source: "website",
    ...(eventMetadata.url && { url: eventMetadata.url }),
    ...(eventMetadata.path && { path: eventMetadata.path }),
    ...(eventMetadata.referrer && { referrer: eventMetadata.referrer }),
    ...utm,
    metadata: eventMetadata,
  };

  const response = await fetch(`${baseUrl}/marketing/ingest-intent-event`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Track event failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

