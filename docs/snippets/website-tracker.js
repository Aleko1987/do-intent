/**
 * DO-Intent Website Tracker Snippet
 * 
 * Copy and paste this script into your HTML page before </body> tag.
 * 
 * Configuration:
 * - Set DO_INTENT_API_BASE to your API base URL (or leave empty for same-origin)
 * - Set DO_INTENT_DEBUG to 'true' to enable console logging
 * 
 * Usage:
 * ```html
 * <script>
 *   window.DO_INTENT_API_BASE = 'https://api.example.com';
 *   window.DO_INTENT_DEBUG = false;
 * </script>
 * <script src="path/to/website-tracker.js"></script>
 * ```
 * 
 * Or inline:
 * ```html
 * <script>
 *   // Paste this entire file here
 * </script>
 * ```
 */

(function() {
  'use strict';
  
  // Configuration
  const API_BASE = (typeof window !== 'undefined' && window.DO_INTENT_API_BASE) || '';
  const DEBUG = (typeof window !== 'undefined' && window.DO_INTENT_DEBUG === 'true') || false;
  
  // Storage keys
  const STORAGE_KEY_ANONYMOUS_ID = 'do_intent_anonymous_id';
  const STORAGE_KEY_SESSION_ID = 'do_intent_session_id';
  
  // Tracked flags (fire-once per page)
  let scrollDepthTracked = false;
  let timeOnPageTracked = false;
  
  /**
   * Generate a UUID v4
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  
  /**
   * Get or create anonymous_id from localStorage
   */
  function getAnonymousId() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return generateUUID();
    }
    
    let anonymousId = localStorage.getItem(STORAGE_KEY_ANONYMOUS_ID);
    if (!anonymousId) {
      anonymousId = generateUUID();
      localStorage.setItem(STORAGE_KEY_ANONYMOUS_ID, anonymousId);
    }
    return anonymousId;
  }
  
  /**
   * Get or create session_id from sessionStorage
   */
  function getSessionId() {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return generateUUID();
    }
    
    let sessionId = sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
    if (!sessionId) {
      sessionId = generateUUID();
      sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
    }
    return sessionId;
  }
  
  /**
   * Detect device type (simple heuristic)
   */
  function detectDevice() {
    if (typeof window === 'undefined') return 'desktop';
    
    const ua = navigator.userAgent.toLowerCase();
    const mobilePattern = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    return mobilePattern.test(ua) ? 'mobile' : 'desktop';
  }
  
  /**
   * Get timezone using Intl API
   */
  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      return '';
    }
  }
  
  /**
   * Extract UTM parameters from URL
   */
  function getUtmParams() {
    if (typeof window === 'undefined') return {};
    
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    
    for (let i = 0; i < utmKeys.length; i++) {
      const key = utmKeys[i];
      const value = params.get(key);
      if (value) {
        utm[key] = value;
      }
    }
    
    return utm;
  }
  
  /**
   * Build metadata object for events
   */
  function buildMetadata(additional) {
    const metadata = {
      device: detectDevice(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timezone: getTimezone(),
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      page_title: typeof document !== 'undefined' ? document.title : '',
    };
    
    // Merge UTM params
    const utm = getUtmParams();
    Object.assign(metadata, utm);
    
    // Merge additional metadata
    if (additional) {
      Object.assign(metadata, additional);
    }
    
    return metadata;
  }
  
  /**
   * Send event to /track endpoint
   */
  function sendTrackEvent(eventType, url, value, metadata) {
    const anonymousId = getAnonymousId();
    const sessionId = getSessionId();
    const timestamp = new Date().toISOString();
    const eventId = generateUUID();
    
    const payload = {
      event: eventType,
      event_id: eventId,
      session_id: sessionId,
      anonymous_id: anonymousId,
      url: url,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      timestamp: timestamp,
    };
    
    if (value !== undefined) {
      payload.value = value;
    }
    
    payload.metadata = JSON.stringify(buildMetadata(metadata));
    
    const endpoint = API_BASE + '/track';
    
    if (DEBUG) {
      console.log('[DO-Intent] Tracking event:', eventType, payload);
    }
    
    // Use fetch with keepalive
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).then(function(response) {
      if (!response.ok) {
        if (DEBUG) {
          response.text().then(function(text) {
            console.warn('[DO-Intent] Track failed:', response.status, text);
          });
        }
      } else {
        if (DEBUG) {
          response.json().then(function(result) {
            console.log('[DO-Intent] Track success:', result);
          });
        }
      }
    }).catch(function(error) {
      if (DEBUG) {
        console.error('[DO-Intent] Track error:', error);
      }
      // Silently fail - don't block UI
    });
  }
  
  /**
   * Track a custom event
   */
  function track(eventType, payload) {
    if (typeof window === 'undefined') return;
    
    const url = window.location.pathname + window.location.search;
    const value = payload && payload.value;
    const metadata = payload && payload.metadata;
    
    sendTrackEvent(eventType, url, value, metadata);
  }
  
  /**
   * Track page_view event
   */
  function trackPageView() {
    const url = window.location.pathname + window.location.search;
    sendTrackEvent('page_view', url);
  }
  
  /**
   * Track scroll_depth event (fires once at 60%)
   */
  function trackScrollDepth() {
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
  function trackTimeOnPage() {
    if (timeOnPageTracked) return;
    
    setTimeout(function() {
      if (!timeOnPageTracked) {
        timeOnPageTracked = true;
        track('time_on_page', { value: 30 });
      }
    }, 30000);
  }
  
  /**
   * Check if element is a CTA
   */
  function isCTA(element) {
    // Check data attribute
    if (element.getAttribute('data-intent-cta') === 'true') {
      return true;
    }
    
    // Check href for pricing/contact
    if (element.tagName === 'A') {
      const href = element.href;
      if (href && (href.indexOf('/pricing') !== -1 || href.indexOf('/contact') !== -1)) {
        return true;
      }
    }
    
    // Check classes for "cta"
    const className = element.className || '';
    if (typeof className === 'string' && className.toLowerCase().indexOf('cta') !== -1) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Track click events on CTA elements
   */
  function handleCTAClick(event) {
    const target = event.target;
    if (!target) return;
    
    // Check target and parent elements
    let element = target;
    for (let i = 0; i < 3 && element; i++) {
      if (isCTA(element)) {
        track('click', {
          metadata: {
            cta_element: element.tagName,
            cta_text: element.textContent ? element.textContent.slice(0, 100) : '',
            cta_href: element.tagName === 'A' ? element.href : undefined,
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
  function setupAutoTracking() {
    // Scroll depth tracking (throttled)
    let scrollTimeout = null;
    window.addEventListener('scroll', function() {
      if (scrollTimeout !== null) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(function() {
        trackScrollDepth();
      }, 100);
    }, { passive: true });
    
    // Time on page tracking
    trackTimeOnPage();
    
    // CTA click tracking
    document.addEventListener('click', handleCTAClick, true);
    
    // Reset flags on page unload (for SPA navigation)
    window.addEventListener('beforeunload', function() {
      scrollDepthTracked = false;
      timeOnPageTracked = false;
    });
  }
  
  /**
   * Identify a user by email
   * 
   * Links anonymous browsing history to a known identity.
   * Call this when you capture an email (e.g., on form submit).
   * 
   * Usage:
   * ```javascript
   * window.DOIntent.identify('user@example.com', 'John Doe')
   *   .then(function(result) {
   *     console.log('Identity ID:', result.identity_id);
   *     console.log('Score:', result.total_identity_score);
   *   });
   * ```
   */
  function identify(email, name) {
    const anonymousId = getAnonymousId();
    const endpoint = API_BASE + '/api/v1/identify';
    
    const payload = {
      anonymous_id: anonymousId,
      email: email.trim().toLowerCase(),
      source: 'website',
    };
    
    if (name) {
      payload.name = name.trim();
    }
    
    if (DEBUG) {
      console.log('[DO-Intent] Identifying user:', payload);
    }
    
    function attemptIdentify() {
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).then(function(response) {
        if (!response.ok) {
          return response.text().then(function(errorText) {
            throw new Error('Identify failed: ' + response.status + ' ' + errorText);
          });
        }
        return response.json();
      }).then(function(result) {
        if (DEBUG) {
          console.log('[DO-Intent] Identify success:', result);
        }
        return result;
      });
    }

    return attemptIdentify().catch(function(error) {
      return new Promise(function(resolve) {
        setTimeout(resolve, 1200);
      }).then(function() {
        return attemptIdentify();
      }).catch(function(retryError) {
        try {
          const url = window.location.pathname + window.location.search;
          sendTrackEvent('identify_fallback', url, undefined, {
            lead_email: email.trim().toLowerCase(),
            lead_name: name ? name.trim() : undefined,
            identify_error: String(retryError),
          });
        } catch (fallbackError) {
          if (DEBUG) {
            console.error('[DO-Intent] Identify fallback error:', fallbackError);
          }
        }
        if (DEBUG) {
          console.error('[DO-Intent] Identify error:', retryError);
        }
        throw retryError;
      });
    });
  }
  
  // Initialize tracker
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        trackPageView();
        setupAutoTracking();
      });
    } else {
      trackPageView();
      setupAutoTracking();
    }
    
    // Expose API globally
    window.DOIntent = {
      track: track,
      identify: identify,
    };
    
    if (DEBUG) {
      console.log('[DO-Intent] Tracker initialized');
    }
  }
})();

