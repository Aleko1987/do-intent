/**
 * DO-Intent Website Tracker
 * 
 * A lightweight, framework-agnostic tracker for capturing user intent signals.
 * Works in vanilla JS and can be imported into React/Vue/etc.
 * 
 * Usage:
 * ```typescript
 * import { init, track, identify } from '@/lib/doIntentTracker';
 * 
 * // Initialize (call once)
 * init({ apiBase: 'https://api.example.com', debug: true });
 * 
 * // Track custom events
 * track('custom_event', { custom_data: 'value' });
 * 
 * // Identify user (on form submit)
 * identify('user@example.com', 'John Doe');
 * ```
 */

// Storage keys
const STORAGE_KEY_ANONYMOUS_ID = 'do_intent_anonymous_id';
const STORAGE_KEY_SESSION_ID = 'do_intent_session_id';
const STORAGE_KEY_SESSION_TS = 'do_intent_session_ts';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Configuration
interface TrackerConfig {
  apiBase?: string;
  debug?: boolean;
  useCookies?: boolean;
}

let config: TrackerConfig = {
  apiBase: '',
  debug: false,
  useCookies: false,
};

// Tracked flags (fire-once per page)
let scrollDepthTracked = false;
let timeOnPageTracked = false;

/**
 * Generate a UUID v4
 */
function generateUUIDFallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return generateUUIDFallback();
}

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function canUseSessionStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.sessionStorage;
  } catch {
    return false;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.slice(name.length + 1));
    }
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSeconds?: number): void {
  if (typeof document === 'undefined') {
    return;
  }
  const encoded = encodeURIComponent(value);
  const maxAge = typeof maxAgeSeconds === 'number' ? `; Max-Age=${maxAgeSeconds}` : '';
  document.cookie = `${name}=${encoded}; Path=/; SameSite=Lax${maxAge}`;
}

function getApiBaseUrl(): string {
  if (config.apiBase && config.apiBase.trim().length > 0) {
    return config.apiBase;
  }

  const envBase = import.meta.env?.VITE_API_BASE_URL;
  if (envBase && envBase.trim().length > 0) {
    return envBase;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }

  return '';
}

/**
 * Get or create anonymous_id from localStorage
 */
function getAnonymousId(): string {
  if (typeof window === 'undefined') {
    return generateUUID();
  }

  const useCookies = config.useCookies || !canUseLocalStorage();
  let anonymousId = useCookies
    ? getCookie(STORAGE_KEY_ANONYMOUS_ID)
    : localStorage.getItem(STORAGE_KEY_ANONYMOUS_ID);

  if (!anonymousId) {
    anonymousId = generateUUID();
    if (useCookies) {
      setCookie(STORAGE_KEY_ANONYMOUS_ID, anonymousId, 60 * 60 * 24 * 365);
    } else {
      localStorage.setItem(STORAGE_KEY_ANONYMOUS_ID, anonymousId);
    }
  }

  return anonymousId;
}

/**
 * Get or create session_id from sessionStorage.
 * Rotates the session after 30 minutes of inactivity.
 */
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return generateUUID();
  }

  const useCookies = config.useCookies || !canUseSessionStorage();

  const now = Date.now();
  const lastSeenRaw = useCookies
    ? getCookie(STORAGE_KEY_SESSION_TS)
    : sessionStorage.getItem(STORAGE_KEY_SESSION_TS);
  const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : null;
  const isExpired =
    lastSeen !== null && !Number.isNaN(lastSeen)
      ? now - lastSeen > SESSION_TIMEOUT_MS
      : false;

  let sessionId = useCookies
    ? getCookie(STORAGE_KEY_SESSION_ID)
    : sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
  if (!sessionId || isExpired) {
    sessionId = generateUUID();
    if (useCookies) {
      setCookie(STORAGE_KEY_SESSION_ID, sessionId, 60 * 60 * 24);
    } else {
      sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
    }
  }

  if (useCookies) {
    setCookie(STORAGE_KEY_SESSION_TS, String(now), 60 * 60 * 24);
  } else {
    sessionStorage.setItem(STORAGE_KEY_SESSION_TS, String(now));
  }
  return sessionId;
}

/**
 * Detect device type (simple heuristic)
 */
function detectDevice(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  const ua = navigator.userAgent.toLowerCase();
  const mobilePattern = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  return mobilePattern.test(ua) ? 'mobile' : 'desktop';
}

/**
 * Get timezone using Intl API
 */
function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
}

function getPageClass(): string {
  if (typeof window === 'undefined') {
    return 'unknown';
  }
  const pathname = window.location.pathname || '';
  if (pathname === '/' || pathname === '') {
    return 'home';
  }
  if (pathname.startsWith('/pricing')) {
    return 'pricing';
  }
  if (pathname.startsWith('/docs')) {
    return 'docs';
  }
  if (pathname.startsWith('/blog')) {
    return 'blog';
  }
  if (pathname.startsWith('/contact')) {
    return 'contact';
  }
  if (pathname.startsWith('/case-study') || pathname.startsWith('/case-studies')) {
    return 'case_study';
  }
  return 'other';
}

function getClerkUserId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const clerk = (window as Window & { Clerk?: { user?: { id?: string } } }).Clerk;
  const userId = clerk?.user?.id;
  if (typeof userId === 'string' && userId.trim().length > 0) {
    return userId;
  }

  return null;
}

/**
 * Extract UTM parameters from URL
 */
function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  }
  
  return utm;
}

function getClickIds(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const clickIds: Record<string, string> = {};
  const clickKeys = ['gclid', 'fbclid', 'msclkid'];

  for (const key of clickKeys) {
    const value = params.get(key);
    if (value) {
      clickIds[key] = value;
    }
  }

  return clickIds;
}

/**
 * Build metadata object for events
 */
function buildMetadata(additional?: Record<string, any>): Record<string, any> {
  const metadata: Record<string, any> = {
    device: detectDevice(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timezone: getTimezone(),
    page_class: getPageClass(),
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    page_title: typeof document !== 'undefined' ? document.title : '',
    ...getUtmParams(),
    ...getClickIds(),
    ...additional,
  };

  const clerkUserId = getClerkUserId();
  if (clerkUserId) {
    metadata.clerk_user_id = clerkUserId;
  }
  
  return metadata;
}

/**
 * Send event to /track endpoint
 */
async function sendTrackEvent(
  eventType: string,
  url: string,
  value?: number,
  metadata?: Record<string, any>
): Promise<void> {
  const anonymousId = getAnonymousId();
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString();
  const eventId = generateUUID();
  
  const payload = {
    event: eventType,
    event_id: eventId,
    session_id: sessionId,
    anonymous_id: anonymousId,
    url,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    timestamp,
    ...(value !== undefined && { value }),
    metadata: buildMetadata(metadata),
  };
  
  const apiBase = getApiBaseUrl();
  const trimmedBase = apiBase.replace(/\/$/, '');
  const endpoint = trimmedBase ? `${trimmedBase}/track` : '/track';
  
  if (config.debug) {
    console.log('[DO-Intent] Tracking event:', eventType, payload);
    console.log('[DO-Intent] API endpoint:', endpoint);
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true, // Ensure request completes even if page unloads
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[DO-Intent] Track failed:', response.status, errorText);
    } else {
      const result = await response.json();
      if (config.debug) {
        console.log('[DO-Intent] Track success:', result);
      }
    }
  } catch (error) {
    console.warn('[DO-Intent] Track error:', error);
    // Silently fail - don't block UI
  }
}

/**
 * Initialize the tracker
 * 
 * @param options Configuration options
 * @param options.apiBase Base URL for API (defaults to same-origin if empty)
 * @param options.debug Enable debug logging (default: false)
 */
export function init(options: TrackerConfig = {}): void {
  config = {
    apiBase: options.apiBase,
    debug: options.debug ?? false,
  };
  
  if (config.debug) {
    console.log('[DO-Intent] Initialized with config:', config);
  }
  
  // Auto-track page_view on init
  if (typeof window !== 'undefined') {
    trackPageView();
    setupAutoTracking();
  }
}

/**
 * Track a custom event
 * 
 * @param eventType Event type (e.g., 'page_view', 'click', 'custom_event')
 * @param payload Optional payload with value and/or metadata
 */
export function track(
  eventType: string,
  payload?: { value?: number; metadata?: Record<string, any> }
): void {
  if (typeof window === 'undefined') return;
  
  const url = window.location.pathname + window.location.search;
  const value = payload?.value;
  const metadata = payload?.metadata;
  
  sendTrackEvent(eventType, url, value, metadata).catch(() => {
    // Already handled in sendTrackEvent
  });
}

/**
 * Track page_view event
 */
function trackPageView(): void {
  const url = window.location.pathname + window.location.search;
  sendTrackEvent('page_view', url).catch(() => {
    // Already handled
  });
}

/**
 * Track scroll_depth event (fires once at 60%)
 */
function trackScrollDepth(): void {
  if (scrollDepthTracked) return;
  
  const scrollPercent = Math.round(
    ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
  );
  
  if (scrollPercent >= 60) {
    scrollDepthTracked = true;
    track('scroll_depth', { value: scrollPercent });
  }
}

/**
 * Track time_on_page event (fires once after 30 seconds)
 */
function trackTimeOnPage(): void {
  if (timeOnPageTracked) return;
  
  setTimeout(() => {
    if (!timeOnPageTracked) {
      timeOnPageTracked = true;
      track('time_on_page', { value: 30 });
    }
  }, 30000);
}

/**
 * Check if element is a CTA
 */
function isCTA(element: HTMLElement): boolean {
  // Check data attribute
  if (element.getAttribute('data-intent-cta') === 'true') {
    return true;
  }
  
  // Check href for pricing/contact
  if (element.tagName === 'A') {
    const href = (element as HTMLAnchorElement).href;
    if (href && (href.includes('/pricing') || href.includes('/contact'))) {
      return true;
    }
  }
  
  // Check classes for "cta"
  const className = element.className || '';
  if (typeof className === 'string' && className.toLowerCase().includes('cta')) {
    return true;
  }
  
  return false;
}

/**
 * Track click events on CTA elements
 */
function handleCTAClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target) return;
  
  // Check target and parent elements
  let element: HTMLElement | null = target;
  for (let i = 0; i < 3 && element; i++) {
    if (isCTA(element)) {
      const url = window.location.pathname + window.location.search;
      track('click', {
        metadata: {
          cta_element: element.tagName,
          cta_text: element.textContent?.slice(0, 100),
          cta_href: element.tagName === 'A' ? (element as HTMLAnchorElement).href : undefined,
        },
      });
      break;
    }
    element = element.parentElement;
  }
}

/**
 * Setup automatic event tracking
 */
function setupAutoTracking(): void {
  // Scroll depth tracking (throttled)
  let scrollTimeout: number | null = null;
  window.addEventListener('scroll', () => {
    if (scrollTimeout !== null) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = window.setTimeout(() => {
      trackScrollDepth();
    }, 100);
  }, { passive: true });
  
  // Time on page tracking
  trackTimeOnPage();
  
  // CTA click tracking
  document.addEventListener('click', handleCTAClick, true);
  
  // Reset flags on page unload (for SPA navigation)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      scrollDepthTracked = false;
      timeOnPageTracked = false;
    });
  }
}

/**
 * Identify a user by email
 * 
 * Links anonymous browsing history to a known identity.
 * Call this when you capture an email (e.g., on form submit).
 * 
 * @param email User email address (required)
 * @param name User name (optional)
 * @returns Promise with identity_id and merged score info
 */
export async function identify(
  email: string,
  name?: string
): Promise<{
  ok: boolean;
  identity_id: string;
  merged: boolean;
  total_identity_score: number;
  band: 'cold' | 'warm' | 'hot' | 'critical';
  threshold_emitted: boolean;
}> {
  const anonymousId = getAnonymousId();
  const apiBase = getApiBaseUrl();
  const trimmedBase = apiBase.replace(/\/$/, '');
  const endpoint = trimmedBase ? `${trimmedBase}/api/v1/identify` : '/api/v1/identify';
  
  const payload = {
    anonymous_id: anonymousId,
    email: email.trim().toLowerCase(),
    ...(name && { name: name.trim() }),
    source: 'website',
  };
  
  if (config.debug) {
    console.log('[DO-Intent] Identifying user:', payload);
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Identify failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    if (config.debug) {
      console.log('[DO-Intent] Identify success:', result);
    }
    
    return result;
  } catch (error) {
    if (config.debug) {
      console.error('[DO-Intent] Identify error:', error);
    }
    throw error;
  }
}

// Note: Auto-initialization is disabled by default.
// Users should call init() explicitly in their app entry point.
// Example: In main.tsx or App.tsx, call init({ apiBase: '...', debug: false })
