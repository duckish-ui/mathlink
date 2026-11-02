import type { Server } from 'socket.io';

/**
 * Broadcast helpers that REST routes call after they change data, so every
 * connected browser can refresh just the parts that changed. They do nothing
 * until the Socket.IO server is attached in index.ts.
 */
let io: Server | null = null;

export function attachEvents(server: Server) {
  io = server;
}

/** A session was created, joined or left: lists and that session's page should refetch. */
export function emitSessionChanged(sessionId: string) {
  io?.emit('sessions:changed', { sessionId });
}

let leaderboardTimer: NodeJS.Timeout | null = null;

/** XP changed somewhere. Throttled so a burst of quiz submissions causes one refetch. */
export function emitLeaderboardChanged() {
  if (!io || leaderboardTimer) return;
  leaderboardTimer = setTimeout(() => {
    leaderboardTimer = null;
    io?.emit('leaderboard:changed');
  }, 1000);
}

/** A short line for the live activity feed, e.g. "Maya scored 5/5 on Quadratics". */
export function emitActivity(message: string, userId: string) {
  io?.emit('activity', { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message, userId, at: Date.now() });
}
