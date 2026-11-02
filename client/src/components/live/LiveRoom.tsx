import { Check, Eye, Loader2, MessageSquare, PenLine, Send, Sparkles, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLiveRoom, type BoardEvent, type LiveRoomApi } from '../../hooks/useLiveRoom';
import { timeAgo } from '../../lib/format';
import type { LivePoll as LivePollData, RoomUser } from '../../lib/types';
import { MathText } from '../MathText';
import { Avatar, Card, buttonStyles, inputStyles } from '../ui';
import { Whiteboard, type WhiteboardHandle } from './Whiteboard';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function Presence({ users }: { users: RoomUser[] }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {users.slice(0, 8).map((u) => (
          <span key={u.id} className="relative">
            <Avatar name={u.name} size="sm" />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          </span>
        ))}
      </div>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        {users.length === 1 ? 'Just you here so far' : `${users.length} here now`}
      </span>
    </div>
  );
}

function Chat({ room, me }: { room: LiveRoomApi; me: string }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastTyped = useRef(0);

  // Stick to the bottom as new messages arrive.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [room.messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    if (await room.sendMessage(body)) setDraft('');
    setSending(false);
  }

  return (
    <Card className="flex h-[32rem] flex-col p-0">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
        <MessageSquare className="size-4 text-zinc-400" />
        <h3 className="font-semibold">Chat</h3>
        <span className="ml-auto text-xs text-zinc-500">Use $x^2$ for math</span>
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {room.messages.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">No messages yet. Say hi 👋</p>}
        {room.messages.map((m) => {
          const mine = m.user.id === me;
          return (
            <div key={m.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
              {!mine && <Avatar name={m.user.name} size="sm" />}
              <div className={`max-w-[80%] ${mine ? 'text-right' : ''}`}>
                <p className="mb-0.5 text-xs text-zinc-500">
                  {mine ? 'You' : m.user.name} · {timeAgo(m.createdAt)}
                </p>
                <div
                  className={`inline-block rounded-2xl px-3.5 py-2 text-left text-sm break-words ${
                    mine ? 'rounded-tr-sm bg-indigo-600 text-white' : 'rounded-tl-sm bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  <MathText text={m.body} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h-5 px-5 text-xs text-zinc-500">
        {room.typing.length > 0 && `${room.typing.slice(0, 2).join(', ')} ${room.typing.length === 1 ? 'is' : 'are'} typing…`}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (Date.now() - lastTyped.current > 2000) {
              lastTyped.current = Date.now();
              room.notifyTyping();
            }
          }}
          maxLength={1000}
          placeholder="Message the room…"
          className={inputStyles}
          aria-label="Chat message"
        />
        <button className={`${buttonStyles.primary} px-3`} disabled={!draft.trim() || sending} aria-label="Send">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </Card>
  );
}

function LivePoll({ poll, room, isHost, roomSize }: { poll: LivePollData | null; room: LiveRoomApi; isHost: boolean; roomSize: number }) {
  if (!poll) {
    return isHost ? (
      <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Pose a live problem</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Everyone answers at once and sees the class results. Correct answers earn +5 XP.</p>
        </div>
        <button className={buttonStyles.primary} onClick={room.startPoll}>
          <Sparkles className="size-4" /> Start a problem
        </button>
      </Card>
    ) : null;
  }

  const answered = room.myAnswer !== null;
  const showResults = answered || poll.revealed || isHost;
  const max = Math.max(1, ...poll.counts);

  return (
    <Card className="border-indigo-200 ring-4 ring-indigo-500/10 dark:border-indigo-500/30">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Sparkles className="size-3.5" /> Live problem
        </span>
        <span className="text-sm text-zinc-500 tabular-nums">
          {poll.totalAnswers} / {roomSize} answered
        </span>
      </div>
      <MathText text={poll.prompt} className="block text-lg font-medium" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {poll.choices.map((choice, i) => {
          const isCorrect = poll.revealed && poll.answerIndex === i;
          const isWrongPick = poll.revealed && room.myAnswer === i && poll.answerIndex !== i;
          const picked = room.myAnswer === i;
          return (
            <button
              key={i}
              disabled={poll.revealed || isHost}
              onClick={() => room.answerPoll(i)}
              className={`relative overflow-hidden rounded-xl border-2 px-4 py-3 text-left transition disabled:cursor-default ${
                isCorrect
                  ? 'border-emerald-500'
                  : isWrongPick
                    ? 'border-red-400'
                    : picked
                      ? 'border-indigo-500'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
              }`}
            >
              {showResults && (
                <span
                  className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${isCorrect ? 'bg-emerald-500/15' : 'bg-indigo-500/10'}`}
                  style={{ width: `${(poll.counts[i] / max) * 100}%` }}
                />
              )}
              <span className="relative flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold dark:bg-zinc-800">
                  {isCorrect ? <Check className="size-4 text-emerald-600" /> : isWrongPick ? <X className="size-4 text-red-500" /> : LETTERS[i]}
                </span>
                <MathText text={choice} className="flex-1" />
                {showResults && <span className="text-sm font-semibold tabular-nums text-zinc-500">{poll.counts[i]}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {poll.revealed && poll.explanation && (
        <p className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-950">
          <MathText text={poll.explanation} />
        </p>
      )}
      {!isHost && !poll.revealed && (
        <p className="mt-3 text-xs text-zinc-500">{answered ? 'Answer locked in. You can still change it until the host reveals.' : 'Pick an answer. The host will reveal it soon.'}</p>
      )}
      {isHost && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!poll.revealed ? (
            <button className={buttonStyles.primary} onClick={room.revealPoll}>
              <Eye className="size-4" /> Reveal answer
            </button>
          ) : (
            <button className={buttonStyles.primary} onClick={room.startPoll}>
              <Sparkles className="size-4" /> Next problem
            </button>
          )}
          <button className={buttonStyles.secondary} onClick={room.closePoll}>
            Close
          </button>
        </div>
      )}
    </Card>
  );
}

/** The interactive part of a session page, shown to people who have joined. */
export function LiveRoom({ sessionId, me, isHost }: { sessionId: string; me: string; isHost: boolean }) {
  const board = useRef<WhiteboardHandle>(null);
  // Board events can arrive before the canvas mounts, so queue them until it does.
  const pending = useRef<BoardEvent[]>([]);
  const onBoard = useCallback((e: BoardEvent) => {
    if (board.current) board.current.apply(e);
    else pending.current.push(e);
  }, []);
  const room = useLiveRoom(sessionId, true, onBoard);

  useEffect(() => {
    if (room.status === 'ready' && board.current) {
      for (const e of pending.current) board.current.apply(e);
      pending.current = [];
    }
  }, [room.status]);

  if (room.status === 'error') {
    return <Card className="text-center text-sm text-zinc-500">{room.error}</Card>;
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-indigo-500" />
          <h2 className="text-xl font-bold tracking-tight">Live room</h2>
          {room.status === 'connecting' && <Loader2 className="size-4 animate-spin text-zinc-400" />}
        </div>
        <Presence users={room.users} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LivePoll poll={room.poll} room={room} isHost={isHost} roomSize={Math.max(0, room.users.length - (isHost ? 1 : 0))} />
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <PenLine className="size-4 text-zinc-400" />
              <h3 className="font-semibold">Shared whiteboard</h3>
            </div>
            <Whiteboard ref={board} myId={me} isHost={isHost} onStroke={room.sendStroke} onUndo={room.undo} onClear={room.clearBoard} />
          </Card>
        </div>
        <Chat room={room} me={me} />
      </div>
    </section>
  );
}
