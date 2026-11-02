import { Check, ChevronLeft, Copy, Crown, Loader2, Play, RotateCcw, Users, WifiOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MathText } from '../components/MathText';
import { Avatar, Card, ErrorState, LoadingState, ProgressBar, buttonStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { emitAck, socket } from '../lib/socket';
import type { BattleState } from '../lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Counts down to the server's deadline, corrected for clock skew between client and server. */
function useCountdown(state: BattleState | null) {
  const [remaining, setRemaining] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    if (state) offset.current = state.serverNow - Date.now();
  }, [state]);
  useEffect(() => {
    if (!state || (state.status !== 'question' && state.status !== 'reveal')) return;
    const tick = () => setRemaining(Math.max(0, state.endsAt - (Date.now() + offset.current)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [state]);
  return remaining;
}

function Scoreboard({ state, me, compact = false }: { state: BattleState; me: string; compact?: boolean }) {
  return (
    <ol className="space-y-2">
      {state.players.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${p.id === me ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''} ${p.connected ? '' : 'opacity-50'}`}
        >
          <span className="w-5 text-center text-sm font-semibold tabular-nums text-zinc-500">{i + 1}</span>
          <Avatar name={p.name} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {p.id === me ? 'You' : p.name}
            {p.id === state.hostId && <Crown className="ml-1 inline size-3.5 text-amber-500" />}
            {!p.connected && <WifiOff className="ml-1 inline size-3.5" />}
          </span>
          {state.status === 'question' && p.answered && <Check className="size-4 text-emerald-500" aria-label="answered" />}
          {state.status === 'reveal' && p.lastPoints > 0 && <span className="text-xs font-semibold text-emerald-600">+{p.lastPoints}</span>}
          {!compact && p.streak >= 2 && <span className="text-xs text-orange-500">🔥{p.streak}</span>}
          <span className="w-14 text-right text-sm font-bold tabular-nums">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

export default function BattlePlay() {
  const { code = '' } = useParams();
  const { user, refreshUser } = useAuth();
  const { connected } = useRealtime();
  const toast = useToast();
  const [state, setState] = useState<BattleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = useCountdown(state);

  // Join on load and again after any reconnect; leave when navigating away.
  useEffect(() => {
    if (!connected) return;
    emitAck<BattleState>('battle:join', { code })
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
    return () => {
      if (socket.connected) socket.emit('battle:leave', {});
    };
  }, [code, connected]);

  const lastKey = useRef('');
  useSocketEvent<BattleState>('battle:state', (s) => {
    if (s.code !== code) return;
    const key = `${s.status}:${s.index}`;
    if (key !== lastKey.current && s.status === 'question') setMyChoice(null);
    if (key !== lastKey.current && s.status === 'finished') void refreshUser();
    lastKey.current = key;
    setState(s);
  });

  async function answer(choice: number) {
    if (!state || myChoice !== null || state.status !== 'question') return;
    setMyChoice(choice);
    try {
      await emitAck('battle:answer', { code, choice });
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  // Number keys answer during a question.
  useEffect(() => {
    if (state?.status !== 'question') return;
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (state.question && i >= 0 && i < state.question.choices.length) void answer(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function hostAction(event: 'battle:start' | 'battle:rematch') {
    setBusy(true);
    try {
      await emitAck(event, { code });
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link to="/battles" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      <ChevronLeft className="size-4" /> All battles
    </Link>
  );

  if (error) return <div>{back}<ErrorState message={error} /></div>;
  if (!state || !user) return <LoadingState label="Joining battle…" />;

  const isHost = state.hostId === user.id;

  if (state.status === 'lobby') {
    const link = `${window.location.origin}/battles/${state.code}`;
    return (
      <div className="mx-auto max-w-3xl">
        {back}
        <Card className="text-center sm:p-10">
          <p className="text-sm font-medium text-zinc-500">Battle code · {state.topic?.name ?? 'Mixed topics'}</p>
          <p className="mt-2 font-mono text-5xl font-extrabold tracking-[0.25em]">{state.code}</p>
          <button
            className={`${buttonStyles.secondary} mt-5`}
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              toast('Invite link copied');
            }}
          >
            <Copy className="size-4" /> Copy invite link
          </button>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {state.players.map((p) => (
              <span key={p.id} className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 text-sm font-medium dark:bg-zinc-800">
                <Avatar name={p.name} size="sm" />
                {p.id === user.id ? 'You' : p.name}
                {p.id === state.hostId && <Crown className="size-3.5 text-amber-500" />}
              </span>
            ))}
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-zinc-500">
            <Users className="size-4" /> {state.players.length} player{state.players.length === 1 ? '' : 's'} in the lobby
          </p>
          {isHost ? (
            <button className={`${buttonStyles.primary} mt-6 px-8`} onClick={() => hostAction('battle:start')} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Start battle{state.players.length === 1 ? ' solo' : ''}
            </button>
          ) : (
            <p className="mt-6 flex items-center justify-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin" /> Waiting for the host to start…
            </p>
          )}
        </Card>
      </div>
    );
  }

  if (state.status === 'finished') {
    const podium = state.players.slice(0, 3);
    const myRank = state.players.findIndex((p) => p.id === user.id) + 1;
    return (
      <div className="mx-auto max-w-3xl">
        {back}
        <Card className="text-center sm:p-10">
          <Crown className="mx-auto size-12 text-amber-500" />
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{podium[0]?.id === user.id ? 'You won!' : `${podium[0]?.name} wins!`}</h1>
          <p className="mt-1 text-zinc-500">You finished #{myRank} of {state.players.length}. XP has been added to your profile.</p>
          <div className="mt-8 flex items-end justify-center gap-3">
            {[1, 0, 2].map((i) => {
              const p = podium[i];
              if (!p) return null;
              const heights = ['h-32', 'h-24', 'h-16'];
              return (
                <div key={p.id} className="flex w-24 flex-col items-center gap-2 sm:w-28">
                  <Avatar name={p.name} />
                  <span className="max-w-full truncate text-sm font-semibold">{p.id === user.id ? 'You' : p.name}</span>
                  <div className={`flex w-full items-start justify-center rounded-t-xl pt-2 text-lg font-bold ${heights[i]} ${i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    {i + 1}
                  </div>
                  <span className="text-xs tabular-nums text-zinc-500">{p.score} pts</span>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex justify-center gap-3">
            {isHost && (
              <button className={buttonStyles.primary} onClick={() => hostAction('battle:rematch')} disabled={busy}>
                <RotateCcw className="size-4" /> Rematch
              </button>
            )}
            <Link to="/battles" className={buttonStyles.secondary}>
              Back to battles
            </Link>
          </div>
        </Card>
        <Card className="mt-6">
          <Scoreboard state={state} me={user.id} />
        </Card>
      </div>
    );
  }

  const q = state.question!;
  const revealing = state.status === 'reveal';
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="mx-auto max-w-5xl">
      {back}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex justify-between text-sm font-medium text-zinc-500">
            <span>
              Question {state.index + 1} of {state.total}
            </span>
            <span className={`tabular-nums ${!revealing && seconds <= 5 ? 'text-red-500' : ''}`}>{revealing ? 'Next question…' : `${seconds}s`}</span>
          </div>
          <ProgressBar percent={revealing ? 100 : (remaining / 20_000) * 100} />
          <Card className="mt-5 sm:p-8">
            <MathText text={q.prompt} className="block text-lg font-medium leading-relaxed sm:text-xl" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {q.choices.map((choice, i) => {
                const correct = revealing && state.answerIndex === i;
                const wrong = revealing && myChoice === i && state.answerIndex !== i;
                const picked = myChoice === i;
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    disabled={myChoice !== null || revealing}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition disabled:cursor-default ${
                      correct
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                        : wrong
                          ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                          : picked
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                            : 'border-zinc-200 enabled:hover:border-zinc-300 enabled:hover:bg-zinc-50 dark:border-zinc-800 dark:enabled:hover:bg-zinc-800/50'
                    } ${myChoice !== null && !picked && !correct ? 'opacity-60' : ''}`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold dark:bg-zinc-800">
                      {correct ? <Check className="size-4 text-emerald-600" /> : wrong ? <X className="size-4 text-red-500" /> : LETTERS[i]}
                    </span>
                    <MathText text={choice} />
                  </button>
                );
              })}
            </div>
            {revealing && state.explanation && (
              <p className="mt-5 rounded-xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-950">
                <MathText text={state.explanation} />
              </p>
            )}
            {!revealing && myChoice !== null && <p className="mt-4 text-center text-sm text-zinc-500">Locked in! Waiting for the others…</p>}
          </Card>
          <p className="mt-4 text-center text-xs text-zinc-500">Tip: press 1–4 to answer.</p>
        </div>
        <Card>
          <h2 className="mb-3 font-semibold">Scores</h2>
          <Scoreboard state={state} me={user.id} compact />
        </Card>
      </div>
    </div>
  );
}
