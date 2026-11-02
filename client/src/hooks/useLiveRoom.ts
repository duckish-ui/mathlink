import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { emitAck, socket } from '../lib/socket';
import type { ChatMessage, LivePoll, RoomUser, Stroke } from '../lib/types';
import { useSocketEvent } from './useSocketEvent';

interface JoinPayload {
  users: RoomUser[];
  messages: ChatMessage[];
  strokes: Stroke[];
  poll: LivePoll | null;
  myPollAnswer: number | null;
}

type BoardEvent = { type: 'add'; stroke: Stroke } | { type: 'remove'; id: string } | { type: 'reset'; strokes: Stroke[] };

/**
 * Everything for one live session room: presence, chat, the shared whiteboard
 * and the host's live problem. Joins on mount (and after reconnects), leaves on unmount.
 */
export function useLiveRoom(sessionId: string, enabled: boolean, onBoard: (e: BoardEvent) => void) {
  const toast = useToast();
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [poll, setPoll] = useState<LivePoll | null>(null);
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});
  const [connectionId, setConnectionId] = useState(0);

  // Re-join after a reconnect: the server forgets room membership when a socket drops.
  useSocketEvent('connect', () => setConnectionId((n) => n + 1));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const join = () =>
      emitAck<JoinPayload>('room:join', { sessionId })
        .then((data) => {
          if (cancelled) return;
          setUsers(data.users);
          setMessages(data.messages);
          setPoll(data.poll);
          setMyAnswer(data.myPollAnswer);
          onBoard({ type: 'reset', strokes: data.strokes });
          setStatus('ready');
          setError(null);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setStatus('error');
          setError(err.message);
        });

    if (socket.connected) void join();
    return () => {
      cancelled = true;
      if (socket.connected) socket.emit('room:leave', { sessionId });
    };
    // onBoard is intentionally excluded: it's a stable ref-based callback from the board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled, connectionId]);

  const mine = (p: { sessionId: string }) => p.sessionId === sessionId;

  useSocketEvent<{ sessionId: string; users: RoomUser[] }>('room:presence', (p) => mine(p) && setUsers(p.users));
  useSocketEvent<{ sessionId: string; message: ChatMessage }>('chat:message', (p) => {
    if (!mine(p)) return;
    setMessages((prev) => [...prev.slice(-199), p.message]);
    setTyping((prev) => {
      const next = { ...prev };
      delete next[p.message.user.id];
      return next;
    });
  });
  useSocketEvent<{ sessionId: string; user: RoomUser }>('chat:typing', (p) => {
    if (mine(p)) setTyping((prev) => ({ ...prev, [p.user.id]: { name: p.user.name, until: Date.now() + 3000 } }));
  });
  useSocketEvent<{ sessionId: string; stroke: Stroke }>('board:stroke', (p) => mine(p) && onBoard({ type: 'add', stroke: p.stroke }));
  useSocketEvent<{ sessionId: string; strokeId: string }>('board:remove', (p) => mine(p) && onBoard({ type: 'remove', id: p.strokeId }));
  useSocketEvent<{ sessionId: string }>('board:clear', (p) => mine(p) && onBoard({ type: 'reset', strokes: [] }));
  useSocketEvent<{ sessionId: string; poll: LivePoll | null; reset?: boolean }>('poll:state', (p) => {
    if (!mine(p)) return;
    setPoll(p.poll);
    if (p.reset || !p.poll) setMyAnswer(null);
  });

  // Expire typing indicators.
  useEffect(() => {
    const id = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const entries = Object.entries(prev).filter(([, t]) => t.until > now);
        return entries.length === Object.keys(prev).length ? prev : Object.fromEntries(entries);
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const run = useCallback(
    async (event: string, payload: object = {}) => {
      try {
        await emitAck(event, { sessionId, ...payload });
        return true;
      } catch (err) {
        toast((err as Error).message, 'error');
        return false;
      }
    },
    [sessionId, toast],
  );

  return {
    status,
    error,
    users,
    messages,
    poll,
    myAnswer,
    typing: Object.values(typing).map((t) => t.name),
    sendMessage: (body: string) => run('chat:send', { body }),
    notifyTyping: () => socket.emit('chat:typing', { sessionId }),
    sendStroke: (stroke: Omit<Stroke, 'userId'>) => run('board:stroke', { stroke }),
    undo: () => run('board:undo'),
    clearBoard: () => run('board:clear'),
    startPoll: () => run('poll:start'),
    revealPoll: () => run('poll:reveal'),
    closePoll: () => run('poll:close'),
    answerPoll: async (choice: number) => {
      if (await run('poll:answer', { choice })) setMyAnswer(choice);
    },
  };
}

export type LiveRoomApi = ReturnType<typeof useLiveRoom>;
export type { BoardEvent };
