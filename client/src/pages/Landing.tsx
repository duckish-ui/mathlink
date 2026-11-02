import { ArrowRight, BarChart3, ListChecks, Sigma, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout';
import { MathText } from '../components/MathText';
import { buttonStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import type { Topic } from '../lib/types';

const features = [
  { icon: Users, title: 'Live study sessions', body: 'Join peer-led sessions with real lessons, worked examples and a meeting room.' },
  { icon: ListChecks, title: 'Graded quizzes', body: 'Practice with server-graded quizzes and step-by-step explanations for every answer.' },
  { icon: BarChart3, title: 'Real progress', body: 'Track XP over time, topic mastery and accuracy, all saved to your account.' },
  { icon: Trophy, title: 'Leaderboards & streaks', body: 'Stay motivated with daily streaks and weekly or all-time rankings.' },
];

export default function Landing() {
  const { user } = useAuth();
  const { data: topics } = useApi<Topic[]>('/topics');

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-zinc-950 dark:to-zinc-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard" className={buttonStyles.primary}>
              Go to dashboard <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonStyles.ghost}>
                Log in
              </Link>
              <Link to="/register" className={buttonStyles.primary}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Sigma className="size-4" /> Learn math together
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">
              Math clicks faster <span className="text-indigo-600 dark:text-indigo-400">with other people.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
              MathLink brings live study sessions, practice quizzes and progress tracking into one place, from algebra to calculus.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? '/dashboard' : '/register'} className={`${buttonStyles.primary} px-6 py-3 text-base`}>
                {user ? 'Continue learning' : 'Start learning free'} <ArrowRight className="size-4" />
              </Link>
              <Link to="/sessions" className={`${buttonStyles.secondary} px-6 py-3 text-base`}>
                Browse sessions
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-indigo-500/5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-500">Today in “Power Rule Power Hour”</p>
            <div className="mt-3 rounded-2xl bg-zinc-50 p-5 text-lg dark:bg-zinc-950">
              <MathText text={String.raw`$$\frac{d}{dx}x^n = n x^{n-1}$$`} />
              <MathText
                className="text-base text-zinc-600 dark:text-zinc-400"
                text={String.raw`So $\frac{d}{dx}\left(4x^3 - 2x\right) = 12x^2 - 2$.`}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ['6', 'topics'],
                ['8', 'quizzes'],
                ['40', 'questions'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl bg-indigo-50 py-3 dark:bg-indigo-500/10">
                  <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{value}</p>
                  <p className="text-xs text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <Icon className="size-6 text-indigo-500" />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
          </div>
        ))}
      </section>

      {topics && (
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
          <h2 className="text-2xl font-bold tracking-tight">Every topic, one place</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => (
              <Link
                key={t.id}
                to={`/quizzes?topic=${t.slug}`}
                className="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <h3 className="font-semibold">{t.name}</h3>
                  <ArrowRight className="ml-auto size-4 text-zinc-400 transition group-hover:translate-x-1" />
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
