import { CalendarCheck, Target, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatTile, buttonStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { formatShortDate, levelInfo, timeAgo } from '../lib/format';
import type { ProgressData } from '../lib/types';

const INDIGO = '#6366f1';

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-semibold tabular-nums">
        {payload[0].value.toLocaleString()} {unit}
      </p>
    </div>
  );
}

export default function Progress() {
  const { user } = useAuth();
  const { data, error, loading, refetch } = useApi<ProgressData>('/progress');

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load progress.'} onRetry={refetch} />;

  const timeline = data.xpTimeline.map((d) => ({ ...d, label: formatShortDate(`${d.date}T12:00:00`) }));
  const gained30 = data.xpTimeline.reduce((sum, d) => sum + d.gained, 0);
  const activeDays = data.xpTimeline.filter((d) => d.gained > 0).length;
  const mastery = data.mastery.map((m) => ({ name: m.topic.name, percent: m.percent }));
  const level = levelInfo(user?.xp ?? 0);

  return (
    <div>
      <PageHeader title="Your progress" subtitle="Everything here is calculated from your real quiz attempts and sessions." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Zap} label="Level" value={level.level} hint={`${level.into}/${level.needed} XP to next level`} />
        <StatTile icon={TrendingUp} label="XP (last 30 days)" value={`+${gained30.toLocaleString()}`} />
        <StatTile icon={Target} label="Answer accuracy" value={data.accuracy === null ? '—' : `${data.accuracy}%`} hint={`${data.totalAttempts} quiz attempts`} />
        <StatTile icon={CalendarCheck} label="Active days" value={`${activeDays}/30`} hint="Days you earned XP" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-semibold">Total XP, last 30 days</h2>
          <div className="mt-4 h-64 text-zinc-500 dark:text-zinc-400">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INDIGO} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.15} />
                <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<ChartTooltip unit="XP" />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.3 }} />
                <Area type="monotone" dataKey="total" stroke={INDIGO} strokeWidth={2} fill="url(#xpFill)" activeDot={{ r: 5, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Mastery by topic</h2>
          <div className="mt-4 h-64 text-zinc-500 dark:text-zinc-400">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mastery} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.15} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} axisLine={false} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} axisLine={false} width={92} />
                <Tooltip content={<ChartTooltip unit="% mastery" />} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
                <Bar dataKey="percent" fill={INDIGO} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        <h2 className="px-5 pt-5 font-semibold">Recent quiz attempts</h2>
        {data.attempts.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No attempts yet" action={<Link to="/quizzes" className={buttonStyles.primary}>Take your first quiz</Link>} />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="px-5 py-3 font-medium">Quiz</th>
                  <th className="px-5 py-3 font-medium">Topic</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                  <th className="px-5 py-3 text-right font-medium">XP</th>
                  <th className="px-5 py-3 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-3 font-medium">
                      <Link to={`/quizzes/${a.quizId}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                        {a.quizTitle}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: a.topic.color }} />
                        {a.topic.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {a.score}/{a.total}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-zinc-500">{a.xpEarned > 0 ? `+${a.xpEarned}` : '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-zinc-500">{timeAgo(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
