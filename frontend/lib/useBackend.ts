import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import backend from "~backend/client";

type Client = typeof import("~backend/client").default;

export function useBackend<T>(
  fetcher: (backend: Client) => Promise<T>,
  deps: any[]
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => void;
};

export function useBackend(): Client;

export function useBackend<T>(
  fetcher?: (backend: Client) => Promise<T>,
  deps?: any[]
): Client | {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => void;
} {
  const { getToken, isSignedIn } = useAuth();

  if (!fetcher) {
    if (!isSignedIn) return backend;
    return backend.with({
      auth: async () => {
        const token = await getToken();
        if (!token) {
          return undefined;
        }
        return { authorization: `Bearer ${token}` };
      },
    });
  }

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const client = isSignedIn
        ? backend.with({
            auth: async () => {
              const token = await getToken();
              if (!token) {
                return undefined;
              }
              return { authorization: `Bearer ${token}` };
            },
          })
        : backend;

      const result = await fetcher(client);
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    execute();
  }, deps || []);

  return { data, loading, error, execute };
}

export function getBackendClient() {
  return backend;
}
