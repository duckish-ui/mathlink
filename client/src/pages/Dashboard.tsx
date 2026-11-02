import { ArrowRight, CalendarDays, Flame, ListChecks, Sparkles, Swords, Trophy, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LiveActivity } from '../components/live/LiveActivity';
import { Card, DifficultyBadge, EmptyState, ErrorState, LoadingState, ProgressBar, StatTile, buttonStyles } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useLiveRefetch } from '../hooks/useSocketEvent';
import { formatDateTime, levelInfo, startsIn, timeAgo } from '../lib/format';
import type { DashboardData } from '../lib/types';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { data, error, loading, refetch } = useApi<DashboardData>('/dashboard');
  // Rank and XP shift as others earn XP, so keep the numbers live.
  useLiveRefetch(['leaderboard:changed', 'sessions:changed'], refetch);

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load your dashboard.'} onRetry={refetch} />;

  const { user, stats, mastery, upcomingSessions, recentActivity, recommendedQuiz } = data;
  const level = levelInfo(stats.xp);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting()}, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {stats.streak > 0 ? `You're on a ${stats.streak}-day streak. Keep it alive today!` : 'Answer a quiz or join a session to start a streak.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Zap} label="Total XP" value={stats.xp.toLocaleString()} hint={`Level ${level.level} · ${level.needed - level.into} XP to next`} />
        <StatTile icon={Flame} label="Day streak" value={stats.streak} hint={stats.streak === 1 ? '1 day' : `${stats.streak} days`} />
        <StatTile icon={Trophy} label="Global rank" value={`#${stats.rank}`} hint="All-time leaderboard" />
        <StatTile icon={ListChecks} label="Quizzes taken" value={stats.quizzesCompleted} hint={`${stats.sessionsJoined} sessions joined`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <LiveActivity />
        </div>
        <Card className="flex flex-col justify-between gap-4 lg:col-span-2">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Swords className="size-4 text-indigo-500" /> Math Battles
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Challenge friends to a real-time quiz race. Speed counts.</p>
          </div>
          <Link to="/battles" className={`${buttonStyles.primary} w-fit`}>
            Find a battle <ArrowRight className="size-4" />
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Topic mastery</h2>
            <Link to="/progress" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Details
            </Link>
          </div>
          <ul className="mt-5 space-y-4">
            {mastery.map((m) => (
              <li key={m.topic.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="size-2 rounded-full" style={{ backgroundColor: m.topic.color }} />
                    {m.topic.name}
                  </span>
                  <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {m.percent}% · {m.quizzesTaken}/{m.quizzesTotal} quizzes
                  </span>
                </div>
                <ProgressBar percent={m.percent} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your upcoming sessions</h2>
            <Link to="/sessions" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Browse
            </Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <div className="mt-5">
              <EmptyState title="Nothing scheduled" body="Join a session to learn with others." action={<Link to="/sessions" className={buttonStyles.primary}>Find a session</Link>} />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {upcomingSessions.map((s) => (
                <li key={s.id}>
                  <Link to={`/sessions/${s.id}`} className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <CalendarDays className="mt-0.5 size-5 shrink-0 text-zinc-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {formatDateTime(s.startsAt)} · {s.host}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      {startsIn(s.startsAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="font-semibold">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No activity yet — your XP history will appear here.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-sm">
                  <span className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                    {a.reason.startsWith('Scored') ? <ListChecks className="size-4" /> : <Users className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{a.reason}</span>
                  <span className="shrink-0 text-zinc-500">{timeAgo(a.createdAt)}</span>
                  <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{a.amount} XP</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col bg-gradient-to-br from-indigo-600 to-violet-600 text-white lg:col-span-2 dark:border-indigo-500/30">
          <span className="flex items-center gap-2 text-sm font-medium text-indigo-100">
            <Sparkles className="size-4" /> Recommended next
          </span>
          {recommendedQuiz ? (
            <>
              <h2 className="mt-3 text-xl font-bold">{recommendedQuiz.title}</h2>
              <p className="mt-1 text-sm text-indigo-100">
                {recommendedQuiz.topic.name} is your lowest-mastery topic. A great place to earn up to {recommendedQuiz.xpReward} XP.
              </p>
              <div className="mt-3">
                <DifficultyBadge difficulty={recommendedQuiz.difficulty} />
              </div>
              <Link
                to={`/quizzes/${recommendedQuiz.id}`}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                Start quiz <ArrowRight className="size-4" />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-indigo-100">You've tried every quiz! Retake one to push your mastery to 100%.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
