import { getAttributionContext } from "./attributionContext";

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
const STORAGE_KEY_ANON_ID_PRIMARY = "do_intent_anonymous_id";
const STORAGE_KEY_SESSION_ID = "doi_session_id";
const STORAGE_KEY_SESSION_LAST_SEEN_AT = "doi_session_last_seen_at";
const STORAGE_KEY_SESSION_ID_LEGACY = "do_intent_session_id";
const STORAGE_KEY_SESSION_TS_LEGACY = "do_intent_session_ts";
const SESSION_TIMEOUT_MS = 45 * 60 * 1000;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.slice(name.length + 1));
    }
  }
  return null;
}

function resolveSharedCookieDomain(): string | undefined {
  if (typeof window === "undefined" || !window.location?.hostname) {
    return undefined;
  }
  const host = window.location.hostname.toLowerCase();
  if (host === "earthcurebiodiesel.com" || host.endsWith(".earthcurebiodiesel.com")) {
    return ".earthcurebiodiesel.com";
  }
  return undefined;
}

function setCookie(name: string, value: string, maxAgeSeconds?: number): void {
  if (typeof document === "undefined") {
    return;
  }
  const encoded = encodeURIComponent(value);
  const maxAge = typeof maxAgeSeconds === "number" ? `; Max-Age=${maxAgeSeconds}` : "";
  const domain = resolveSharedCookieDomain();
  const domainAttr = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=${encoded}; Path=/; SameSite=Lax${maxAge}${domainAttr}`;
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const envBase = import.meta.env.VITE_DO_INTENT_BASE_URL || import.meta.env.VITE_API_BASE_URL;
  if (!envBase) {
    throw new Error("VITE_DO_INTENT_BASE_URL or VITE_API_BASE_URL is not set");
  }
  return envBase;
}

/**
 * Get or create anonymous ID (UUID stored in localStorage)
 */
export function getAnonId(): string {
  let anonId =
    localStorage.getItem(STORAGE_KEY_ANON_ID_PRIMARY) ||
    localStorage.getItem(STORAGE_KEY_ANON_ID) ||
    getCookie(STORAGE_KEY_ANON_ID_PRIMARY) ||
    getCookie(STORAGE_KEY_ANON_ID);
  if (!anonId) {
    // Generate a simple UUID v4
    anonId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  // Keep both keys in sync for backwards compatibility.
  localStorage.setItem(STORAGE_KEY_ANON_ID_PRIMARY, anonId);
  localStorage.setItem(STORAGE_KEY_ANON_ID, anonId);
  setCookie(STORAGE_KEY_ANON_ID_PRIMARY, anonId, 60 * 60 * 24 * 365);
  setCookie(STORAGE_KEY_ANON_ID, anonId, 60 * 60 * 24 * 365);
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
  utm_term?: string;
  utm_id?: string;
} {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"];
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  }
  return utm;
}

function getSessionId(): string {
  const now = Date.now();
  const lastSeenRaw =
    sessionStorage.getItem(STORAGE_KEY_SESSION_LAST_SEEN_AT) ||
    sessionStorage.getItem(STORAGE_KEY_SESSION_TS_LEGACY) ||
    getCookie(STORAGE_KEY_SESSION_LAST_SEEN_AT) ||
    getCookie(STORAGE_KEY_SESSION_TS_LEGACY);
  const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : null;
  const isExpired =
    lastSeen !== null && !Number.isNaN(lastSeen) ? now - lastSeen > SESSION_TIMEOUT_MS : false;

  let sessionId =
    sessionStorage.getItem(STORAGE_KEY_SESSION_ID) ||
    sessionStorage.getItem(STORAGE_KEY_SESSION_ID_LEGACY) ||
    getCookie(STORAGE_KEY_SESSION_ID) ||
    getCookie(STORAGE_KEY_SESSION_ID_LEGACY);

  if (!sessionId || isExpired) {
    sessionId = generateUUID();
  }

  sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
  sessionStorage.setItem(STORAGE_KEY_SESSION_ID_LEGACY, sessionId);
  sessionStorage.setItem(STORAGE_KEY_SESSION_LAST_SEEN_AT, String(now));
  sessionStorage.setItem(STORAGE_KEY_SESSION_TS_LEGACY, String(now));

  setCookie(STORAGE_KEY_SESSION_ID, sessionId, 60 * 60 * 24);
  setCookie(STORAGE_KEY_SESSION_ID_LEGACY, sessionId, 60 * 60 * 24);
  setCookie(STORAGE_KEY_SESSION_LAST_SEEN_AT, String(now), 60 * 60 * 24);
  setCookie(STORAGE_KEY_SESSION_TS_LEGACY, String(now), 60 * 60 * 24);

  return sessionId;
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
  const baseUrl = resolveApiBaseUrl();

  const apiKey = import.meta.env.VITE_DO_INTENT_KEY;
  const anonId = getAnonId();
  const sessionId = getSessionId();
  const attribution = getAttributionContext();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Include API key in production (or if set in dev)
  if (apiKey) {
    headers["x-do-intent-key"] = apiKey;
  }

  const body = {
    anonymous_id: anonId,
    session_id: sessionId,
    email: email.trim().toLowerCase(),
    ...(company_name && { company_name: company_name.trim() }),
    ...(contact_name && { contact_name: contact_name.trim() }),
    ...(Object.keys(attribution).length > 0 ? { metadata: { attribution } } : {}),
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
  const baseUrl = resolveApiBaseUrl();

  const apiKey = import.meta.env.VITE_DO_INTENT_KEY;
  const anonId = getAnonId();
  const sessionId = getSessionId();
  const eventId = generateUUID();
  const utm = getUtmParams();
  const attribution = getAttributionContext();

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
    session_id: sessionId,
    url: window.location.href,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    ...(Object.keys(attribution).length > 0 ? { attribution, ...attribution } : {}),
    ...utm,
  };

  const body = {
    lead_id,
    event_type,
    event_source: "website",
    event_id: eventId,
    anonymous_id: anonId,
    session_id: sessionId,
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

