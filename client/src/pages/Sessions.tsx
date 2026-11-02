import { CalendarDays, Clock, Loader2, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar, Card, EmptyState, ErrorState, FilterChips, LoadingState, PageHeader, ProgressBar, TopicBadge, buttonStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useJoinSession } from '../hooks/useJoinSession';
import { useLiveRefetch } from '../hooks/useSocketEvent';
import { formatDateTime, startsIn } from '../lib/format';
import type { SessionSummary, Topic } from '../lib/types';

type Scope = 'upcoming' | 'mine' | 'past';

export function StatusPill({ session }: { session: SessionSummary }) {
  if (session.status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
        Live now
      </span>
    );
  }
  if (session.status === 'ended') {
    return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Ended</span>;
  }
  return <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">Starts {startsIn(session.startsAt)}</span>;
}

export default function Sessions() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? 'all';
  const scope = (params.get('scope') as Scope | null) ?? 'upcoming';

  const { data: topics } = useApi<Topic[]>('/topics');
  const query = new URLSearchParams({ scope, ...(topic !== 'all' ? { topic } : {}) });
  const { data: sessions, error, loading, refetch } = useApi<SessionSummary[]>(`/sessions?${query}`);
  const { toggle, pendingId } = useJoinSession(refetch);
  useLiveRefetch(['sessions:changed'], refetch);

  function update(key: string, value: string, fallback: string) {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  const scopes: { value: Scope; label: string }[] = [
    { value: 'upcoming', label: 'Upcoming' },
    ...(user ? [{ value: 'mine' as Scope, label: 'My sessions' }] : []),
    { value: 'past', label: 'Past' },
  ];

  return (
    <div>
      <PageHeader
        title="Study sessions"
        subtitle="Learn live with other students. Joining a session earns 15 XP."
        action={
          <Link to="/sessions/new" className={buttonStyles.primary}>
            <Plus className="size-4" /> Host a session
          </Link>
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        <FilterChips options={scopes} value={scope} onChange={(v) => update('scope', v, 'upcoming')} />
        <FilterChips
          options={[{ value: 'all', label: 'All topics' }, ...(topics ?? []).map((t) => ({ value: t.slug, label: t.name, color: t.color }))]}
          value={topic}
          onChange={(v) => update('topic', v, 'all')}
        />
      </div>

      {loading && !sessions ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : sessions && sessions.length === 0 ? (
        <EmptyState
          title="No sessions here yet"
          body={scope === 'mine' ? "You haven't joined any upcoming sessions." : 'Try another topic, or host one yourself.'}
          action={<Link to="/sessions/new" className={buttonStyles.primary}>Host a session</Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions?.map((s) => {
            const full = s.attendeeCount >= s.capacity;
            const isHost = s.host.id === user?.id;
            return (
              <Card key={s.id} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <TopicBadge topic={s.topic} />
                  <StatusPill session={s} />
                </div>
                <Link to={`/sessions/${s.id}`} className="mt-3 text-lg font-semibold hover:text-indigo-600 dark:hover:text-indigo-400">
                  {s.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{s.description}</p>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" /> {formatDateTime(s.startsAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" /> {s.durationMin} min
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {s.attendeeCount} / {s.capacity} spots filled
                    </span>
                    {full && <span className="font-semibold text-amber-600">Full</span>}
                  </div>
                  <ProgressBar percent={(s.attendeeCount / s.capacity) * 100} />
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <Avatar name={s.host.name} size="sm" />
                    <span className="truncate text-zinc-600 dark:text-zinc-400">
                      Hosted by <span className="font-medium text-zinc-900 dark:text-zinc-100">{isHost ? 'you' : s.host.name}</span>
                    </span>
                  </span>
                  {s.status !== 'ended' && !isHost && (
                    <button
                      onClick={() => toggle(s)}
                      disabled={pendingId === s.id || (full && !s.joined)}
                      className={s.joined ? buttonStyles.secondary : buttonStyles.primary}
                    >
                      {pendingId === s.id && <Loader2 className="size-4 animate-spin" />}
                      {s.joined ? 'Leave' : full ? 'Full' : 'Join'}
                    </button>
                  )}
                  {(s.status === 'ended' || isHost) && (
                    <Link to={`/sessions/${s.id}`} className={buttonStyles.secondary}>
                      {isHost ? 'Manage' : 'View lesson'}
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
