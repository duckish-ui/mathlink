import axios from 'axios';

export const TOKEN_KEY = 'mathlink.token';

/** Axios instance for our own Express API (proxied to :4000 by Vite in dev). */
export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Pulls the server's `{ error }` message out of an Axios error. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}
