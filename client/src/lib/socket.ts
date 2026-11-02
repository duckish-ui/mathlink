import { io } from 'socket.io-client';
import { TOKEN_KEY } from './api';

/**
 * One shared Socket.IO connection for the whole app. It sends the same JWT the
 * REST API uses, read fresh on every (re)connect so logging in or out just
 * needs a reconnect. In dev, Vite proxies /socket.io to the Express server.
 */
export const socket = io({
  autoConnect: false,
  transports: ['websocket', 'polling'],
  auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }),
});

type AckResponse<T> = { ok: true; data?: T } | { ok: false; error: string };

/** Emits an event and resolves with the server's acknowledgement, or rejects with its error. */
export function emitAck<T = unknown>(event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload ?? {}, (err: Error | null, res: AckResponse<T>) => {
      if (err) reject(new Error('The server did not respond. Check your connection.'));
      else if (!res.ok) reject(new Error(res.error));
      else resolve(res.data as T);
    });
  });
}
