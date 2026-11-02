import { CalendarDays, ChevronLeft, Clock, Loader2, Lock, Users, Video } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LiveRoom } from '../components/live/LiveRoom';
import { Lesson } from '../components/MathText';
import { Avatar, Card, ErrorState, LoadingState, ProgressBar, TopicBadge, buttonStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useJoinSession } from '../hooks/useJoinSession';
import { useLiveRefetch } from '../hooks/useSocketEvent';
import { formatDateTime } from '../lib/format';
import type { SessionDetail as SessionDetailData } from '../lib/types';
import { StatusPill } from './Sessions';

export default function SessionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: session, error, loading, refetch } = useApi<SessionDetailData>(`/sessions/${id}`);
  const { toggle, pendingId } = useJoinSession(refetch);
  // Someone else joining or leaving updates the attendee list without a reload.
  useLiveRefetch(['sessions:changed'], refetch, (p) => (p as { sessionId?: string }).sessionId === id);

  if (loading && !session) return <LoadingState />;
  if (error || !session) return <ErrorState message={error ?? 'Session not found.'} onRetry={refetch} />;

  const isHost = session.host.id === user?.id;
  const full = session.attendeeCount >= session.capacity;

  return (
    <div>
      <Link to="/sessions" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ChevronLeft className="size-4" /> All sessions
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <TopicBadge topic={session.topic} />
        <StatusPill session={session} />
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{session.title}</h1>
      <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400">{session.description}</p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 sm:p-8">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-zinc-500">Lesson notes</h2>
          {session.lesson.trim() ? (
            <Lesson source={session.lesson} />
          ) : (
            <p className="text-zinc-500">The host hasn't added lesson notes yet.</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <CalendarDays className="size-4 text-zinc-400" /> {formatDateTime(session.startsAt)}
              </li>
              <li className="flex items-center gap-3">
                <Clock className="size-4 text-zinc-400" /> {session.durationMin} minutes
              </li>
              <li className="flex items-center gap-3">
                <Users className="size-4 text-zinc-400" /> {session.attendeeCount} / {session.capacity} attending
              </li>
            </ul>
            <ProgressBar percent={(session.attendeeCount / session.capacity) * 100} className="mt-4" />

            <div className="mt-5 flex flex-col gap-2">
              {session.meetingUrl ? (
                <a href={session.meetingUrl} target="_blank" rel="noreferrer" className={buttonStyles.primary}>
                  <Video className="size-4" /> Open meeting room
                </a>
              ) : (
                session.status !== 'ended' && (
                  <p className="flex items-center gap-2 text-xs text-zinc-500">
                    <Lock className="size-3.5" /> The meeting link unlocks after you join.
                  </p>
                )
              )}
              {session.status !== 'ended' && !isHost && (
                <button
                  onClick={() => toggle(session)}
                  disabled={pendingId === session.id || (full && !session.joined)}
                  className={session.joined ? buttonStyles.secondary : buttonStyles.primary}
                >
                  {pendingId === session.id && <Loader2 className="size-4 animate-spin" />}
                  {session.joined ? 'Leave session' : full ? 'Session is full' : 'Join session · +15 XP'}
                </button>
              )}
              {isHost && <p className="text-center text-xs text-zinc-500">You're hosting this session.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">Host</h2>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={session.host.name} />
              <span className="font-medium">{session.host.name}</span>
            </div>
            <h2 className="mt-6 font-semibold">Attendees ({session.attendees.length})</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {session.attendees.map((a) => (
                <span key={a.id} className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 text-sm dark:bg-zinc-800">
                  <Avatar name={a.name} size="sm" />
                  {a.id === user?.id ? 'You' : a.name.split(' ')[0]}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {user && session.joined ? (
        <LiveRoom sessionId={session.id} me={user.id} isHost={isHost} />
      ) : (
        session.status !== 'ended' && (
          <Card className="mt-10 flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-indigo-500" />
            <p className="font-semibold">Join to enter the live room</p>
            <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Attendees share a real-time whiteboard and chat, and answer live problems the host poses.
            </p>
          </Card>
        )
      )}
    </div>
  );
}
