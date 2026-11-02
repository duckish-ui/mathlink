import { useEffect, useRef } from 'react';
import { socket } from '../lib/socket';

/**
 * Subscribes to a socket event for the lifetime of the component. The latest
 * handler is always called, so callers don't need to memoize it.
 */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const listener = (payload: T) => ref.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}

/** Calls `refetch` whenever one of the given events arrives (and after a reconnect). */
export function useLiveRefetch(events: string[], refetch: () => void, filter?: (payload: unknown) => boolean) {
  const ref = useRef({ refetch, filter });
  ref.current = { refetch, filter };
  const key = events.join('|');

  useEffect(() => {
    const listener = (payload: unknown) => {
      if (!ref.current.filter || ref.current.filter(payload)) ref.current.refetch();
    };
    const onReconnect = () => ref.current.refetch();
    for (const e of key.split('|')) socket.on(e, listener);
    socket.io.on('reconnect', onReconnect);
    return () => {
      for (const e of key.split('|')) socket.off(e, listener);
      socket.io.off('reconnect', onReconnect);
    };
  }, [key]);
}
