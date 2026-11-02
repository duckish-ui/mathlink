import { ArrowRight, Loader2, Swords, Timer, Trophy, Users, Zap } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, EmptyState, FilterChips, PageHeader, buttonStyles, inputStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { emitAck, socket } from '../lib/socket';
import type { BattleLobby, Topic } from '../lib/types';

export default function Battles() {
  const { user } = useAuth();
  const { connected } = useRealtime();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: topics } = useApi<Topic[]>('/topics');
  const [topic, setTopic] = useState('all');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [lobbies, setLobbies] = useState<BattleLobby[] | null>(null);

  // Open lobbies are pushed live, so this list updates as people create and fill battles.
  useEffect(() => {
    if (!connected) return;
    socket.emit('battles:list', (res: { ok: boolean; data?: BattleLobby[] }) => setLobbies(res.data ?? []));
  }, [connected]);
  useSocketEvent<BattleLobby[]>('battles:changed', setLobbies);

  async function create() {
    if (!user) return navigate('/login', { state: { from: '/battles' } });
    setCreating(true);
    try {
      const { code } = await emitAck<{ code: string }>('battle:create', { topic: topic === 'all' ? null : topic });
      navigate(`/battles/${code}`);
    } catch (err) {
      toast((err as Error).message, 'error');
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length === 5) navigate(`/battles/${clean}`);
  }

  return (
    <div>
      <PageHeader title="Math Battles" subtitle="Race friends through the same questions in real time. Faster correct answers score more." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Swords className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Start a battle</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Pick a topic, share the code, and hit start.</p>
            </div>
          </div>
          <div className="mt-6">
            <FilterChips
              options={[{ value: 'all', label: 'Mixed' }, ...(topics ?? []).map((t) => ({ value: t.slug, label: t.name, color: t.color }))]}
              value={topic}
              onChange={setTopic}
            />
          </div>
          <ul className="mt-6 grid gap-3 text-sm text-zinc-600 sm:grid-cols-3 dark:text-zinc-400">
            <li className="flex items-center gap-2">
              <Timer className="size-4 text-indigo-500" /> 7 questions · 20s each
            </li>
            <li className="flex items-center gap-2">
              <Zap className="size-4 text-indigo-500" /> Speed + streak bonuses
            </li>
            <li className="flex items-center gap-2">
              <Trophy className="size-4 text-indigo-500" /> Up to 50 XP
            </li>
          </ul>
          <button className={`${buttonStyles.primary} mt-6 w-full sm:w-auto`} onClick={create} disabled={creating || !connected}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />}
            Create battle
          </button>
        </Card>

        <Card className="lg:col-span-2 sm:p-8">
          <h2 className="text-lg font-semibold">Have a code?</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Enter the 5-character code a friend shared.</p>
          <form onSubmit={join} className="mt-5 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              placeholder="ABCDE"
              className={`${inputStyles} font-mono text-lg tracking-[0.3em] uppercase`}
              aria-label="Battle code"
            />
            <button className={buttonStyles.primary} disabled={code.length !== 5}>
              Join <ArrowRight className="size-4" />
            </button>
          </form>
        </Card>
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold">Open lobbies</h2>
      {lobbies === null ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Connecting…
        </div>
      ) : lobbies.length === 0 ? (
        <EmptyState title="No open battles right now" body="Create one and invite a friend, or wait here: new lobbies show up instantly." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lobbies.map((l) => (
            <Link key={l.code} to={`/battles/${l.code}`}>
              <Card className="transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-500/40">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold tracking-widest">{l.code}</span>
                  <span className="flex items-center gap-1 text-sm text-zinc-500">
                    <Users className="size-4" /> {l.playerCount}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {l.host}'s battle · {l.topic?.name ?? 'Mixed topics'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
