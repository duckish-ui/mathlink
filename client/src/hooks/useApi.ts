import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';

/**
 * Fetches `url` from our API with useState + useEffect.
 * Re-fetches whenever the URL changes, and cancels stale requests.
 * Pass `null` to skip fetching.
 */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api
      .get<T>(url, { signal: controller.signal })
      .then((res) => setData(res.data))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [url, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  return { data, error, loading, refetch };
}
