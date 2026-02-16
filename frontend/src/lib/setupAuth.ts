// setupAuth.ts - Wait for Clerk session before API calls

export function setupAuthInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Wait for Clerk to be ready (up to 5 seconds)
    if (typeof window !== "undefined") {
      const clerk = (window as any).Clerk;

      // Wait for Clerk to load
      let attempts = 0;
      while (!clerk?.session && attempts < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }

      // Get token if session exists
      if (clerk?.session) {
        try {
          const token = await clerk.session.getToken();
          if (token) {
            init = init || {};
            const headers = new Headers(init.headers);
            headers.set("Authorization", `Bearer ${token}`);
            init.headers = headers;
          }
        } catch (e) {
          console.log("[Auth] Failed to get token:", e);
        }
      }
    }

    return originalFetch(input, init);
  };
}

setupAuthInterceptor();
