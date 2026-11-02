import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { verifyToken } from './auth.js';
import { registerBattleHandlers } from './battles.js';
import { attachEvents } from './events.js';
import { prisma } from './prisma.js';
import { randomQuestions, type BankQuestion } from './questions.js';
import { awardXp } from './xp.js';

export interface SocketUser {
  id: string;
  name: string;
}

export type AppSocket = Socket & { data: { user?: SocketUser } };

type Ack<T = unknown> = (res: { ok: true; data?: T } | { ok: false; error: string }) => void;

const POLL_XP = 5;
const MAX_STROKES = 1500;
const MAX_POINTS = 600;

interface Stroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: [number, number][];
}

interface Poll {
  question: BankQuestion;
  answers: Map<string, number>;
  revealed: boolean;
}

/** In-memory state for one live session room. Chat is persisted; the board and poll are ephemeral. */
interface Room {
  hostId: string;
  topicSlug: string;
  members: Map<string, { name: string; sockets: Set<string> }>;
  strokes: Stroke[];
  poll: Poll | null;
}

const rooms = new Map<string, Room>();
const channel = (sessionId: string) => `session:${sessionId}`;

function presence(room: Room) {
  return [...room.members.entries()].map(([id, m]) => ({ id, name: m.name }));
}

function pollView(poll: Poll | null) {
  if (!poll) return null;
  const counts = poll.question.choices.map(() => 0);
  for (const choice of poll.answers.values()) counts[choice]++;
  return {
    questionId: poll.question.id,
    prompt: poll.question.prompt,
    choices: poll.question.choices,
    counts,
    totalAnswers: poll.answers.size,
    revealed: poll.revealed,
    // The answer only leaves the server once the host reveals it.
    answerIndex: poll.revealed ? poll.question.answerIndex : null,
    explanation: poll.revealed ? poll.question.explanation : null,
  };
}

const sessionIdSchema = z.object({ sessionId: z.string().min(1).max(64) });
const chatSchema = sessionIdSchema.extend({ body: z.string().trim().min(1).max(1000) });
const strokeSchema = sessionIdSchema.extend({
  stroke: z.object({
    id: z.string().min(1).max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    width: z.number().min(1).max(40),
    points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(MAX_POINTS),
  }),
});
const pollAnswerSchema = sessionIdSchema.extend({ choice: z.number().int().min(0).max(9) });

/** Simple per-socket token bucket so one client can't flood a room. */
function rateLimiter(perSecond: number, burst: number) {
  let tokens = burst;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * perSecond);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

export function initRealtime(httpServer: HttpServer, corsOrigin: string | false) {
  const io = new Server(httpServer, {
    cors: corsOrigin ? { origin: corsOrigin } : undefined,
    // Recover rooms and missed events after a brief network blip.
    connectionStateRecovery: { maxDisconnectionDuration: 60_000 },
  });
  attachEvents(io);

  // Sockets authenticate with the same JWT as the REST API. Guests may connect
  // to receive global updates, but can't enter rooms.
  io.use(async (socket: AppSocket, next) => {
    const userId = verifyToken(socket.handshake.auth?.token);
    if (!userId) return next();
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
      if (user) socket.data.user = user;
      next();
    } catch (err) {
      console.error('socket auth failed', err);
      next(new Error('Server unavailable, retrying…'));
    }
  });

  const broadcastOnline = () => io.emit('online', { count: io.engine.clientsCount });

  io.on('connection', (socket: AppSocket) => {
    broadcastOnline();
    const allow = rateLimiter(20, 40);
    const joined = new Set<string>();

    /** Wraps a handler with validation, auth and rate limiting. */
    function on<S extends z.ZodType>(event: string, schema: S, handler: (user: SocketUser, input: z.infer<S>, ack: Ack) => unknown) {
      socket.on(event, async (raw: unknown, maybeAck?: unknown) => {
        const ack: Ack = typeof maybeAck === 'function' ? (maybeAck as Ack) : () => {};
        const user = socket.data.user;
        if (!user) return ack({ ok: false, error: 'Please log in first.' });
        if (!allow()) return ack({ ok: false, error: 'Slow down a little.' });
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return ack({ ok: false, error: 'Invalid request.' });
        try {
          await handler(user, parsed.data, ack);
        } catch (err) {
          console.error(`socket ${event} failed`, err);
          ack({ ok: false, error: 'Something went wrong.' });
        }
      });
    }

    function memberRoom(user: SocketUser, sessionId: string) {
      const room = rooms.get(sessionId);
      return room && room.members.has(user.id) && joined.has(sessionId) ? room : null;
    }

    function leaveRoom(sessionId: string) {
      const user = socket.data.user;
      const room = rooms.get(sessionId);
      joined.delete(sessionId);
      void socket.leave(channel(sessionId));
      if (!user || !room) return;
      const member = room.members.get(user.id);
      member?.sockets.delete(socket.id);
      if (member && member.sockets.size === 0) {
        room.members.delete(user.id);
        io.to(channel(sessionId)).emit('room:presence', { sessionId, users: presence(room) });
      }
      // Free memory once a room is empty and has nothing worth keeping.
      if (room.members.size === 0 && room.strokes.length === 0 && !room.poll) rooms.delete(sessionId);
    }

    on('room:join', sessionIdSchema, async (user, { sessionId }, ack) => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { hostId: true, topic: { select: { slug: true } }, attendees: { where: { userId: user.id }, select: { userId: true } } },
      });
      if (!session) return ack({ ok: false, error: 'Session not found.' });
      if (session.attendees.length === 0) return ack({ ok: false, error: 'Join the session to enter the live room.' });

      let room = rooms.get(sessionId);
      if (!room) {
        room = { hostId: session.hostId, topicSlug: session.topic.slug, members: new Map(), strokes: [], poll: null };
        rooms.set(sessionId, room);
      }
      const member = room.members.get(user.id) ?? { name: user.name, sockets: new Set<string>() };
      member.sockets.add(socket.id);
      room.members.set(user.id, member);
      joined.add(sessionId);
      await socket.join(channel(sessionId));

      const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: { user: { select: { id: true, name: true } } },
      });

      io.to(channel(sessionId)).emit('room:presence', { sessionId, users: presence(room) });
      ack({
        ok: true,
        data: {
          users: presence(room),
          messages: messages.reverse().map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, user: m.user })),
          strokes: room.strokes,
          poll: pollView(room.poll),
          myPollAnswer: room.poll?.answers.get(user.id) ?? null,
        },
      });
    });

    on('room:leave', sessionIdSchema, (_user, { sessionId }, ack) => {
      leaveRoom(sessionId);
      ack({ ok: true });
    });

    on('chat:send', chatSchema, async (user, { sessionId, body }, ack) => {
      if (!memberRoom(user, sessionId)) return ack({ ok: false, error: 'You are not in this room.' });
      const message = await prisma.chatMessage.create({ data: { sessionId, userId: user.id, body } });
      io.to(channel(sessionId)).emit('chat:message', {
        sessionId,
        message: { id: message.id, body, createdAt: message.createdAt, user },
      });
      ack({ ok: true });
    });

    on('chat:typing', sessionIdSchema, (user, { sessionId }) => {
      if (memberRoom(user, sessionId)) socket.to(channel(sessionId)).emit('chat:typing', { sessionId, user });
    });

    on('board:stroke', strokeSchema, (user, { sessionId, stroke }, ack) => {
      const room = memberRoom(user, sessionId);
      if (!room) return ack({ ok: false, error: 'You are not in this room.' });
      const saved: Stroke = { ...stroke, userId: user.id };
      room.strokes.push(saved);
      if (room.strokes.length > MAX_STROKES) room.strokes.splice(0, room.strokes.length - MAX_STROKES);
      socket.to(channel(sessionId)).emit('board:stroke', { sessionId, stroke: saved });
      ack({ ok: true });
    });

    on('board:undo', sessionIdSchema, (user, { sessionId }, ack) => {
      const room = memberRoom(user, sessionId);
      if (!room) return ack({ ok: false, error: 'You are not in this room.' });
      const index = room.strokes.findLastIndex((s) => s.userId === user.id);
      if (index === -1) return ack({ ok: true });
      const [removed] = room.strokes.splice(index, 1);
      io.to(channel(sessionId)).emit('board:remove', { sessionId, strokeId: removed.id });
      ack({ ok: true });
    });

    on('board:clear', sessionIdSchema, (user, { sessionId }, ack) => {
      const room = memberRoom(user, sessionId);
      if (!room) return ack({ ok: false, error: 'You are not in this room.' });
      if (room.hostId !== user.id) return ack({ ok: false, error: 'Only the host can clear the board.' });
      room.strokes = [];
      io.to(channel(sessionId)).emit('board:clear', { sessionId });
      ack({ ok: true });
    });

    on('poll:start', sessionIdSchema, async (user, { sessionId }, ack) => {
      const room = memberRoom(user, sessionId);
      if (!room) return ack({ ok: false, error: 'You are not in this room.' });
      if (room.hostId !== user.id) return ack({ ok: false, error: 'Only the host can start a problem.' });
      const [question] = await randomQuestions(1, room.topicSlug);
      if (!question) return ack({ ok: false, error: 'No questions available.' });
      room.poll = { question, answers: new Map(), revealed: false };
      io.to(channel(sessionId)).emit('poll:state', { sessionId, poll: pollView(room.poll), reset: true });
      ack({ ok: true });
    });

    on('poll:answer', pollAnswerSchema, (user, { sessionId, choice }, ack) => {
      const room = memberRoom(user, sessionId);
      const poll = room?.poll;
      if (!room || !poll) return ack({ ok: false, error: 'There is no open problem.' });
      if (room.hostId === user.id) return ack({ ok: false, error: 'The host can see the answers already.' });
      if (poll.revealed) return ack({ ok: false, error: 'The answer was already revealed.' });
      if (choice >= poll.question.choices.length) return ack({ ok: false, error: 'Invalid choice.' });
      poll.answers.set(user.id, choice);
      io.to(channel(sessionId)).emit('poll:state', { sessionId, poll: pollView(poll) });
      ack({ ok: true });
    });

    on('poll:reveal', sessionIdSchema, async (user, { sessionId }, ack) => {
      const room = memberRoom(user, sessionId);
      const poll = room?.poll;
      if (!room || !poll) return ack({ ok: false, error: 'There is no open problem.' });
      if (room.hostId !== user.id) return ack({ ok: false, error: 'Only the host can reveal the answer.' });
      if (poll.revealed) return ack({ ok: true });
      poll.revealed = true;
      io.to(channel(sessionId)).emit('poll:state', { sessionId, poll: pollView(poll) });
      ack({ ok: true });
      const winners = [...poll.answers.entries()].filter(([, c]) => c === poll.question.answerIndex).map(([id]) => id);
      await Promise.all(winners.map((id) => awardXp(id, POLL_XP, 'Solved a live problem')));
    });

    on('poll:close', sessionIdSchema, (user, { sessionId }, ack) => {
      const room = memberRoom(user, sessionId);
      if (!room) return ack({ ok: false, error: 'You are not in this room.' });
      if (room.hostId !== user.id) return ack({ ok: false, error: 'Only the host can close the problem.' });
      room.poll = null;
      io.to(channel(sessionId)).emit('poll:state', { sessionId, poll: null });
      ack({ ok: true });
    });

    registerBattleHandlers(io, socket, on);

    socket.on('disconnect', () => {
      for (const sessionId of [...joined]) leaveRoom(sessionId);
      broadcastOnline();
    });
  });

  return io;
}

export type OnHandler = <S extends z.ZodType>(
  event: string,
  schema: S,
  handler: (user: SocketUser, input: z.infer<S>, ack: Ack) => unknown,
) => void;
