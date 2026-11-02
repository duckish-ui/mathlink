import { Crown, Flame, Medal } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Card, EmptyState, ErrorState, FilterChips, LoadingState, PageHeader } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useLiveRefetch } from '../hooks/useSocketEvent';
import type { LeaderboardEntry } from '../lib/types';

type Range = 'week' | 'all';

const podiumStyles = [
  'bg-amber-50 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40',
  'bg-zinc-100 ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-600',
  'bg-orange-50 ring-orange-300 dark:bg-orange-500/10 dark:ring-orange-500/40',
];
const medalColors = ['text-amber-500', 'text-zinc-400', 'text-orange-500'];

export default function Leaderboard() {
  const [range, setRange] = useState<Range>('week');
  const { data, error, loading, refetch } = useApi<LeaderboardEntry[]>(`/leaderboard?range=${range}`);
  useLiveRefetch(['leaderboard:changed'], refetch);

  const podium = data?.slice(0, 3) ?? [];
  const rest = data?.slice(3) ?? [];

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Earn XP from quizzes and sessions to climb the ranks."
        action={
          <FilterChips
            options={[
              { value: 'week', label: 'This week' },
              { value: 'all', label: 'All time' },
            ]}
            value={range}
            onChange={setRange}
          />
        }
      />

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data?.length === 0 ? (
        <EmptyState title="No XP earned yet this week" body="Be the first on the board — take a quiz!" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {podium.map((entry, i) => (
              <Card key={entry.userId} className={`flex flex-col items-center text-center ring-2 ${podiumStyles[i]} ${i === 0 ? 'sm:order-2 sm:-mt-4' : i === 1 ? 'sm:order-1' : 'sm:order-3'}`}>
                {i === 0 ? <Crown className={`size-7 ${medalColors[i]}`} /> : <Medal className={`size-7 ${medalColors[i]}`} />}
                <div className="mt-3">
                  <Avatar name={entry.name} />
                </div>
                <p className="mt-2 font-semibold">
                  {entry.name}
                  {entry.isYou && <span className="ml-1 text-indigo-600 dark:text-indigo-400">(you)</span>}
                </p>
                <p className="text-2xl font-bold tabular-nums">{entry.xp.toLocaleString()} XP</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                  <Flame className="size-4 text-orange-500" /> {entry.streak}-day streak
                </p>
              </Card>
            ))}
          </div>

          {rest.length > 0 && (
            <Card className="mt-6 p-0">
              <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rest.map((entry) => (
                  <li key={entry.userId} className={`flex items-center gap-4 px-5 py-3 ${entry.isYou ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}>
                    <span className="w-6 text-right font-semibold tabular-nums text-zinc-500">{entry.rank}</span>
                    <Avatar name={entry.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {entry.name}
                      {entry.isYou && <span className="ml-1 text-indigo-600 dark:text-indigo-400">(you)</span>}
                    </span>
                    <span className="hidden items-center gap-1 text-sm text-zinc-500 sm:flex">
                      <Flame className="size-4 text-orange-500" /> {entry.streak}
                    </span>
                    <span className="w-24 text-right font-semibold tabular-nums">{entry.xp.toLocaleString()} XP</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
