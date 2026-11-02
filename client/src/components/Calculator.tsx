import axios from 'axios';
import { Calculator as CalculatorIcon, CornerDownLeft, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Card, inputStyles } from './ui';

// External HTTPS API — math.js evaluates expressions, derivatives, matrices and unit conversions.
// We use plain axios here (not our `api` instance) so the user's auth token is never sent to a third party.
const MATHJS_URL = 'https://api.mathjs.org/v4/';

const examples = ["derivative('x^3 + 2x', 'x')", 'sin(pi / 6)', 'det([1, 2; 3, 4])', 'combinations(10, 3)', '5 inch to cm'];

interface Entry {
  expr: string;
  result: string;
  ok: boolean;
}

export default function Calculator() {
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  async function evaluate(expression: string) {
    if (!expression.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get<string>(MATHJS_URL, { params: { expr: expression }, responseType: 'text' });
      setHistory((h) => [{ expr: expression, result: res.data, ok: true }, ...h].slice(0, 6));
      setExpr('');
    } catch (err) {
      const message = axios.isAxiosError(err) && typeof err.response?.data === 'string' ? err.response.data : 'Could not reach the math.js API';
      setHistory((h) => [{ expr: expression, result: message, ok: false }, ...h].slice(0, 6));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    evaluate(expr);
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalculatorIcon className="size-5 text-indigo-500" />
        <h2 className="font-semibold">Scratchpad calculator</h2>
        <span className="ml-auto text-xs text-zinc-500">powered by api.mathjs.org</span>
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          className={`${inputStyles} font-mono`}
          placeholder="Try: derivative('x^2', 'x')"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          aria-label="Math expression"
        />
        <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <CornerDownLeft className="size-4" />}
          <span className="hidden sm:inline">Evaluate</span>
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => evaluate(ex)}
            className="rounded-lg bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {ex}
          </button>
        ))}
      </div>
      {history.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl bg-zinc-50 font-mono text-sm dark:divide-zinc-800 dark:bg-zinc-950">
          {history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2.5">
              <span className="text-zinc-500">{h.expr}</span>
              <span className={h.ok ? 'font-semibold' : 'text-red-500'}>{h.ok ? `= ${h.result}` : h.result}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
