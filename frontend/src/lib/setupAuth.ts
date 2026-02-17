// setupAuth.ts - Add auth token only to do-intent API calls

export function setupAuthInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Get the URL from the input
    const url = typeof input === "string" 
      ? input 
      : input instanceof URL 
        ? input.href 
        : (input as Request).url;

    // Only add auth header to do-intent API calls (not Clerk or other origins)
    if (url.includes("do-intent.onrender.com")) {
      if (typeof window !== "undefined") {
        const clerk = (window as any).Clerk;

        // Wait for Clerk to load (up to 5 seconds)
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
    }

    return originalFetch(input, init);
  };
}

setupAuthInterceptor();
