import { BookOpen, Flame, LayoutDashboard, ListChecks, LogOut, Swords, TrendingUp, Trophy, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { levelInfo } from '../lib/format';
import { Avatar, buttonStyles, ProgressBar } from './ui';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions', label: 'Sessions', icon: Users },
  { to: '/battles', label: 'Battles', icon: Swords },
  { to: '/quizzes', label: 'Quizzes', icon: ListChecks },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/resources', label: 'Resources', icon: BookOpen },
];

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="text-lg">
        Math<span className="text-indigo-600 dark:text-indigo-400">Link</span>
      </span>
    </Link>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition whitespace-nowrap ${
    isActive
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
  }`;
}

function UserCard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <Link to="/register" className={buttonStyles.primary}>
          Create free account
        </Link>
        <Link to="/login" className={buttonStyles.secondary}>
          Log in
        </Link>
      </div>
    );
  }

  const { level, into, needed, percent } = levelInfo(user.xp);
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Level {level}</p>
        </div>
        <span className="flex items-center gap-1 text-sm font-semibold text-orange-500" title="Day streak">
          <Flame className="size-4" />
          {user.streak}
        </span>
      </div>
      <ProgressBar percent={percent} className="mt-3" />
      <p className="mt-1.5 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {into} / {needed} XP to level {level + 1}
      </p>
      <button
        className={`${buttonStyles.ghost} mt-2 w-full justify-start px-2`}
        onClick={() => {
          logout();
          navigate('/');
        }}
      >
        <LogOut className="size-4" /> Log out
      </button>
    </div>
  );
}

function OnlineBadge() {
  const { connected, online } = useRealtime();
  return (
    <p className="flex items-center gap-2 px-3 pb-3 text-xs text-zinc-500 dark:text-zinc-400" title={connected ? 'Live updates on' : 'Reconnecting…'}>
      <span className="relative flex size-2">
        {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex size-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
      </span>
      {connected ? `${online} ${online === 1 ? 'person' : 'people'} online` : 'Reconnecting…'}
    </p>
  );
}

export default function Layout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6 md:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <OnlineBadge />
        <UserCard />
      </aside>

      {/* Mobile header + scrolling tab bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          {user ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-orange-500">
              <Flame className="size-4" />
              {user.streak} · {user.xp} XP
            </span>
          ) : (
            <Link to="/login" className="text-sm font-semibold text-indigo-600">
              Log in
            </Link>
          )}
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
