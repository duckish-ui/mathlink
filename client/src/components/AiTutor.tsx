import { Bot, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { MathText } from './MathText';

/**
 * Asks the server's AI tutor (Groq) for a hint or a walkthrough of one question.
 * The answer is cached per question so re-opening it doesn't call the API again.
 */
export function AiTutor({ mode, questionId, selected }: { mode: 'hint' | 'explain'; questionId: string; selected?: number }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ text: string }>(`/ai/${mode}`, mode === 'hint' ? { questionId } : { questionId, selected: selected ?? -1 });
      setText(res.data.text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (text) {
    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm leading-relaxed dark:border-violet-500/30 dark:bg-violet-500/10">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
          <Bot className="size-3.5" /> AI tutor
        </p>
        <div className="space-y-2 whitespace-pre-line">
          <MathText text={text} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={ask}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-60 dark:text-violet-300 dark:hover:bg-violet-500/10"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {mode === 'hint' ? 'Get a hint' : 'Explain step by step'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
