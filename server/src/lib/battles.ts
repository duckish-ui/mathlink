import type { Server } from 'socket.io';
import { z } from 'zod';
import { emitActivity } from './events.js';
import { prisma } from './prisma.js';
import { randomQuestions, type BankQuestion } from './questions.js';
import type { AppSocket, OnHandler } from './realtime.js';
import { awardXp } from './xp.js';

/**
 * Math Battles: a host opens a lobby with a short code, friends join, and
 * everyone races through the same questions in real time. The server owns the
 * clock, the answers and the scoring, so clients can't cheat by reading state.
 */

const QUESTION_COUNT = 7;
const QUESTION_MS = 20_000;
const REVEAL_MS = 4_500;
const MAX_PLAYERS = 12;
const PLACE_XP = [40, 25, 15];
const PLAY_XP = 10;

type Status = 'lobby' | 'question' | 'reveal' | 'finished';

interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  connected: boolean;
  choice: number | null;
  answeredAt: number | null;
  lastPoints: number;
}

interface Battle {
  code: string;
  hostId: string;
  topic: { slug: string; name: string } | null;
  status: Status;
  players: Map<string, Player>;
  questions: BankQuestion[];
  index: number;
  endsAt: number;
  timer: NodeJS.Timeout | null;
  createdAt: number;
}

const battles = new Map<string, Battle>();
const channel = (code: string) => `battle:${code}`;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (battles.has(code));
  return code;
}

/** Everything a client needs to render the battle. Answers only appear after a reveal. */
function view(b: Battle) {
  const q = b.questions[b.index];
  const showAnswer = b.status === 'reveal' || b.status === 'finished';
  return {
    code: b.code,
    hostId: b.hostId,
    topic: b.topic,
    status: b.status,
    index: b.index,
    total: b.questions.length || QUESTION_COUNT,
    endsAt: b.endsAt,
    serverNow: Date.now(),
    question: q && b.status !== 'lobby' ? { prompt: q.prompt, choices: q.choices } : null,
    answerIndex: showAnswer && q ? q.answerIndex : null,
    explanation: showAnswer && q ? q.explanation : null,
    players: [...b.players.values()]
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        streak: p.streak,
        connected: p.connected,
        answered: p.choice !== null,
        choice: showAnswer ? p.choice : null,
        lastPoints: showAnswer ? p.lastPoints : 0,
      }))
      .sort((a, b) => b.score - a.score),
  };
}

function lobbyList() {
  return [...battles.values()]
    .filter((b) => b.status === 'lobby' && b.players.size > 0)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20)
    .map((b) => ({
      code: b.code,
      topic: b.topic,
      host: b.players.get(b.hostId)?.name ?? 'Someone',
      playerCount: b.players.size,
    }));
}

export function registerBattleHandlers(io: Server, socket: AppSocket, on: OnHandler) {
  let currentCode: string | null = null;

  const emitState = (b: Battle) => io.to(channel(b.code)).emit('battle:state', view(b));
  const emitList = () => io.emit('battles:changed', lobbyList());

  function schedule(b: Battle, ms: number, fn: () => void) {
    if (b.timer) clearTimeout(b.timer);
    b.timer = setTimeout(fn, ms);
  }

  function startQuestion(b: Battle) {
    b.status = 'question';
    b.endsAt = Date.now() + QUESTION_MS;
    for (const p of b.players.values()) {
      p.choice = null;
      p.answeredAt = null;
      p.lastPoints = 0;
    }
    emitState(b);
    schedule(b, QUESTION_MS, () => reveal(b));
  }

  function reveal(b: Battle) {
    if (b.status !== 'question') return;
    const q = b.questions[b.index];
    for (const p of b.players.values()) {
      if (p.choice === q.answerIndex && p.answeredAt !== null) {
        // Faster answers earn more: 500 for being right plus up to 500 for speed, plus a streak bonus.
        const remaining = Math.max(0, b.endsAt - p.answeredAt) / QUESTION_MS;
        p.streak += 1;
        p.lastPoints = 500 + Math.round(500 * remaining) + Math.min(p.streak - 1, 4) * 50;
        p.score += p.lastPoints;
      } else {
        p.streak = 0;
        p.lastPoints = 0;
      }
    }
    b.status = 'reveal';
    b.endsAt = Date.now() + REVEAL_MS;
    emitState(b);
    schedule(b, REVEAL_MS, () => {
      if (b.index + 1 >= b.questions.length) void finish(b);
      else {
        b.index += 1;
        startQuestion(b);
      }
    });
  }

  async function finish(b: Battle) {
    b.status = 'finished';
    b.timer = null;
    emitState(b);
    const ranked = [...b.players.values()].sort((x, y) => y.score - x.score);
    if (ranked.length >= 2 && ranked[0].score > 0) {
      emitActivity(`${ranked[0].name} won a Math Battle with ${ranked[0].score} points`, ranked[0].id);
    }
    // Only award placement XP when there was real competition.
    const competitive = ranked.length >= 2;
    await Promise.all(
      ranked.map((p, i) => {
        const xp = PLAY_XP + (competitive && p.score > 0 ? (PLACE_XP[i] ?? 0) : 0);
        return awardXp(p.id, xp, competitive && i < 3 && p.score > 0 ? `Placed #${i + 1} in a Math Battle` : 'Played a Math Battle');
      }),
    ).catch((err) => console.error('battle XP failed', err));
    // Keep the results around briefly so late viewers can see the podium.
    setTimeout(() => {
      if (battles.get(b.code) === b && b.status === 'finished') battles.delete(b.code);
    }, 10 * 60_000);
  }

  function leave() {
    const user = socket.data.user;
    const code = currentCode;
    currentCode = null;
    if (!user || !code) return;
    void socket.leave(channel(code));
    const b = battles.get(code);
    if (!b) return;
    const stillHere = [...(io.sockets.adapter.rooms.get(channel(code)) ?? [])].some(
      (id) => (io.sockets.sockets.get(id) as AppSocket | undefined)?.data.user?.id === user.id,
    );
    if (stillHere) return; // the same user has the battle open in another tab

    if (b.status === 'lobby') {
      b.players.delete(user.id);
      if (b.players.size > 0 && b.hostId === user.id) b.hostId = b.players.keys().next().value!;
      emitList();
    } else {
      const p = b.players.get(user.id);
      if (p) p.connected = false;
    }
    emitState(b);
    // Give people a moment to reconnect or refresh before tearing an empty battle down.
    if (![...b.players.values()].some((p) => p.connected)) {
      setTimeout(() => {
        if (battles.get(code) !== b || [...b.players.values()].some((p) => p.connected)) return;
        if (b.timer) clearTimeout(b.timer);
        battles.delete(code);
        emitList();
      }, 30_000);
    }
  }

  const codeSchema = z.object({ code: z.string().trim().toUpperCase().length(5) });

  socket.on('battles:list', (ack: unknown) => {
    if (typeof ack === 'function') ack({ ok: true, data: lobbyList() });
  });

  on('battle:create', z.object({ topic: z.string().max(40).nullish() }), async (user, { topic }, ack) => {
    leave();
    const t = topic ? await prisma.topic.findUnique({ where: { slug: topic }, select: { slug: true, name: true } }) : null;
    const b: Battle = {
      code: newCode(),
      hostId: user.id,
      topic: t,
      status: 'lobby',
      players: new Map(),
      questions: [],
      index: 0,
      endsAt: 0,
      timer: null,
      createdAt: Date.now(),
    };
    battles.set(b.code, b);
    emitList();
    ack({ ok: true, data: { code: b.code } });
  });

  on('battle:join', codeSchema, async (user, { code }, ack) => {
    const b = battles.get(code);
    if (!b) return ack({ ok: false, error: 'No battle with that code. It may have ended.' });
    const existing = b.players.get(user.id);
    if (!existing) {
      if (b.status !== 'lobby') return ack({ ok: false, error: 'That battle already started.' });
      if (b.players.size >= MAX_PLAYERS) return ack({ ok: false, error: 'That battle is full.' });
    }
    if (currentCode && currentCode !== code) leave();
    currentCode = code;
    await socket.join(channel(code));
    if (existing) existing.connected = true;
    else {
      b.players.set(user.id, { id: user.id, name: user.name, score: 0, streak: 0, connected: true, choice: null, answeredAt: null, lastPoints: 0 });
      // Whoever is first into an empty lobby hosts it (normally the creator).
      if (b.players.size === 1) b.hostId = user.id;
      emitList();
    }
    emitState(b);
    ack({ ok: true, data: view(b) });
  });

  on('battle:leave', z.object({}), (_user, _input, ack) => {
    leave();
    ack({ ok: true });
  });

  on('battle:start', codeSchema, async (user, { code }, ack) => {
    const b = battles.get(code);
    if (!b) return ack({ ok: false, error: 'Battle not found.' });
    if (b.hostId !== user.id) return ack({ ok: false, error: 'Only the host can start.' });
    if (b.status !== 'lobby') return ack({ ok: false, error: 'Already started.' });
    b.questions = await randomQuestions(QUESTION_COUNT, b.topic?.slug);
    b.index = 0;
    emitList();
    startQuestion(b);
    ack({ ok: true });
  });

  on('battle:answer', codeSchema.extend({ choice: z.number().int().min(0).max(9) }), (user, { code, choice }, ack) => {
    const b = battles.get(code);
    const p = b?.players.get(user.id);
    if (!b || !p) return ack({ ok: false, error: 'You are not in this battle.' });
    if (b.status !== 'question' || Date.now() > b.endsAt) return ack({ ok: false, error: 'Too late!' });
    if (p.choice !== null) return ack({ ok: false, error: 'You already answered.' });
    if (choice >= b.questions[b.index].choices.length) return ack({ ok: false, error: 'Invalid choice.' });
    p.choice = choice;
    p.answeredAt = Date.now();
    ack({ ok: true });
    // Reveal early once every connected player has answered.
    const waiting = [...b.players.values()].some((x) => x.connected && x.choice === null);
    if (waiting) emitState(b);
    else reveal(b);
  });

  on('battle:rematch', codeSchema, (user, { code }, ack) => {
    const b = battles.get(code);
    if (!b || b.status !== 'finished') return ack({ ok: false, error: 'Battle not found.' });
    if (b.hostId !== user.id) return ack({ ok: false, error: 'Only the host can start a rematch.' });
    b.status = 'lobby';
    b.questions = [];
    b.index = 0;
    b.createdAt = Date.now();
    for (const [id, p] of b.players) {
      if (!p.connected) b.players.delete(id);
      else Object.assign(p, { score: 0, streak: 0, choice: null, answeredAt: null, lastPoints: 0 });
    }
    emitState(b);
    emitList();
    ack({ ok: true });
  });

  socket.on('disconnect', leave);
}
