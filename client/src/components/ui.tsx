import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { initials } from '../lib/format';
import type { Difficulty, TopicRef } from '../lib/types';

export const buttonStyles = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
};

export const inputStyles =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-700 dark:bg-zinc-900';

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Topic identity is carried by the colored dot; the label stays in normal ink. */
export function TopicBadge({ topic }: { topic: TopicRef }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <span className="size-2 rounded-full" style={{ backgroundColor: topic.color }} />
      {topic.name}
    </span>
  );
}

const difficultyStyles: Record<Difficulty, string> = {
  easy: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  medium: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
  hard: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${difficultyStyles[difficulty]}`}>
      {difficulty}
    </span>
  );
}

export function ProgressBar({ percent, className = '' }: { percent: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 ${className}`}>
      <div
        className="h-full rounded-full bg-indigo-500 transition-[width] duration-700"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="flex items-start gap-4">
      <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
    </Card>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-xs';
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 ring-2 ring-white dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-zinc-900 ${dims}`}
    >
      {initials(name)}
    </span>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
      <Loader2 className="size-5 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button className={buttonStyles.secondary} onClick={onRetry}>
          Try again
        </button>
      )}
    </Card>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800'
            }`}
          >
            {o.color && <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
