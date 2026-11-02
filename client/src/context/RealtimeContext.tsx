import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { socket } from '../lib/socket';
import { useAuth } from './AuthContext';

export interface ActivityItem {
  id: string;
  message: string;
  userId: string;
  at: number;
}

interface RealtimeValue {
  connected: boolean;
  online: number;
  activity: ActivityItem[];
}

const RealtimeContext = createContext<RealtimeValue>({ connected: false, online: 0, activity: [] });

/** Owns the socket's lifecycle: connects on load and reconnects whenever the logged-in user changes. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, loading, refreshUser } = useAuth();
  const [connected, setConnected] = useState(socket.connected);
  const [online, setOnline] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading) return;
    // Reconnect so the server sees the new token (or lack of one).
    socket.disconnect().connect();
  }, [userId, loading]);

  useEffect(() => () => void socket.disconnect(), []);

  // XP can change from live problems and battles, so keep the sidebar card fresh.
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onOnline = ({ count }: { count: number }) => setOnline(count);
    const onActivity = (item: ActivityItem) => setActivity((prev) => [item, ...prev].slice(0, 8));
    const onLeaderboard = () => void refreshRef.current();

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('online', onOnline);
    socket.on('activity', onActivity);
    socket.on('leaderboard:changed', onLeaderboard);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('online', onOnline);
      socket.off('activity', onActivity);
      socket.off('leaderboard:changed', onLeaderboard);
    };
  }, []);

  return <RealtimeContext.Provider value={{ connected, online, activity }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
