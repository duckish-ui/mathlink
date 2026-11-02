import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Layout';
import { buttonStyles, inputStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const isLogin = mode === 'login';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4 py-12 dark:from-indigo-950/40 dark:to-zinc-950">
      <Logo />
      <div className="mt-8 w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-indigo-500/5 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isLogin ? 'Log in to keep your streak going.' : 'Start earning XP in under a minute.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {!isLogin && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Name</span>
              <input className={inputStyles} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input className={inputStyles} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Password</span>
            <input
              className={inputStyles}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLogin ? undefined : 8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

          <button className={`${buttonStyles.primary} w-full py-3`} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {isLogin ? 'Log in' : 'Create account'}
          </button>

          {isLogin && (
            <button
              type="button"
              className={`${buttonStyles.secondary} w-full`}
              onClick={() => {
                setEmail('demo@mathlink.dev');
                setPassword('password123');
              }}
            >
              Fill in demo account
            </button>
          )}
        </form>
      </div>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {isLogin ? 'New to MathLink? ' : 'Already have an account? '}
        <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          {isLogin ? 'Create an account' : 'Log in'}
        </Link>
      </p>
    </div>
  );
}
