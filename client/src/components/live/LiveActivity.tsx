import { Radio } from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext';
import { Card } from '../ui';

/** "Happening now": how many people are online plus a live feed of what they're doing. */
export function LiveActivity() {
  const { online, activity, connected } = useRealtime();
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Radio className="size-4 text-red-500" /> Happening now
        </h2>
        <span className="flex items-center gap-1.5 text-sm text-zinc-500">
          <span className={`size-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
          {online} online
        </span>
      </div>
      {activity.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Live updates appear here as people ace quizzes, host sessions and win battles.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {activity.map((a) => (
            <li key={a.id} className="toast-in text-sm text-zinc-700 dark:text-zinc-300">
              {a.message}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
