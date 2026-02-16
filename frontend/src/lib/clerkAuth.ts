/**
 * Clerk Authentication Helper for Encore API
 * Gets the JWT token from Clerk and provides it for API calls.
 */

interface ClerkSession {
  getToken: () => Promise<string | null>;
}

interface ClerkGlobal {
  session?: ClerkSession | null;
}

declare global {
  interface Window {
    Clerk?: ClerkGlobal;
  }
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * Get Clerk JWT token.
 * Uses window.Clerk for direct access after Clerk has loaded.
 */
export async function getClerkToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const clerk = window.Clerk;

    if (!clerk?.session) {
      return null;
    }

    const token = await clerk.session.getToken();

    if (token) {
      cachedToken = token;
      tokenExpiry = Date.now() + 30_000;
      return token;
    }

    cachedToken = null;
    tokenExpiry = 0;
    return null;
  } catch (error) {
    console.error("[Auth] Failed to get Clerk token:", error);
    return null;
  }
}
