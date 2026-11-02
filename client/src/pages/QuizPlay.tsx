import { ArrowLeft, ArrowRight, Check, ChevronLeft, Loader2, RotateCcw, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AiTutor } from '../components/AiTutor';
import { MathText } from '../components/MathText';
import { Card, DifficultyBadge, ErrorState, LoadingState, ProgressBar, TopicBadge, buttonStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { api, errorMessage } from '../lib/api';
import type { QuizDetail, QuizResult } from '../lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function QuizPlay() {
  const { id } = useParams();
  const { refreshUser } = useAuth();
  const toast = useToast();
  const { data: quiz, error, loading, refetch } = useApi<QuizDetail>(`/quizzes/${id}`);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the attempt whenever a (new) quiz loads.
  useEffect(() => {
    if (quiz) {
      setAnswers(quiz.questions.map(() => -1));
      setCurrent(0);
      setResult(null);
    }
  }, [quiz]);

  const total = quiz?.questions.length ?? 0;
  const isLast = current === total - 1;

  function choose(choice: number) {
    setAnswers((prev) => prev.map((a, i) => (i === current ? choice : a)));
  }

  async function submit() {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await api.post<QuizResult>(`/quizzes/${quiz.id}/submit`, { answers });
      setResult(res.data);
      if (res.data.xpEarned > 0) toast(`+${res.data.xpEarned} XP earned!`);
      await refreshUser();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Keyboard shortcuts: 1–4 / A–D pick an answer, arrows or Enter move between questions.
  useEffect(() => {
    if (!quiz || result) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const question = quiz!.questions[current];
      const byNumber = Number(e.key) - 1;
      const byLetter = LETTERS.indexOf(e.key.toUpperCase());
      const pick = byNumber >= 0 && byNumber < question.choices.length ? byNumber : byLetter;
      if (pick >= 0 && pick < question.choices.length) setAnswers((prev) => prev.map((a, i) => (i === current ? pick : a)));
      else if (e.key === 'ArrowRight' || e.key === 'Enter') setCurrent((c) => Math.min(c + 1, quiz!.questions.length - 1));
      else if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quiz, current, result]);

  if (loading && !quiz) return <LoadingState />;
  if (error || !quiz) return <ErrorState message={error ?? 'Quiz not found.'} onRetry={refetch} />;

  const header = (
    <div className="mb-6">
      <Link to="/quizzes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ChevronLeft className="size-4" /> All quizzes
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <TopicBadge topic={quiz.topic} />
        <DifficultyBadge difficulty={quiz.difficulty} />
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{quiz.title}</h1>
    </div>
  );

  if (result) {
    const percent = Math.round((result.score / result.total) * 100);
    const improved = result.previousBest !== null && result.score > result.previousBest;
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <Card className="text-center sm:p-10">
          <Trophy className={`mx-auto size-12 ${percent >= 80 ? 'text-amber-500' : 'text-zinc-400'}`} />
          <p className="mt-4 text-5xl font-extrabold tabular-nums">
            {result.score}
            <span className="text-zinc-400">/{result.total}</span>
          </p>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {percent === 100 ? 'Perfect score!' : percent >= 80 ? 'Great work!' : percent >= 50 ? 'Solid effort, review the explanations below.' : 'Keep practicing, you’ve got this.'}
          </p>
          <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            {result.xpEarned > 0
              ? `+${result.xpEarned} XP${improved ? ` · new best (was ${result.previousBest}/${result.total})` : ''}`
              : result.previousBest !== null
                ? `No new XP — beat your best of ${result.previousBest}/${result.total} to earn more`
                : 'No XP this time'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => { setResult(null); setAnswers(quiz.questions.map(() => -1)); setCurrent(0); }} className={buttonStyles.secondary}>
              <RotateCcw className="size-4" /> Retake
            </button>
            <Link to="/quizzes" className={buttonStyles.primary}>
              More quizzes
            </Link>
          </div>
        </Card>

        <h2 className="mb-4 mt-10 text-lg font-semibold">Review</h2>
        <div className="space-y-4">
          {quiz.questions.map((q, i) => {
            const r = result.results[i];
            return (
              <Card key={q.id}>
                <div className="flex gap-3">
                  <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${r.correct ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'}`}>
                    {r.correct ? <Check className="size-4" /> : <X className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <MathText text={q.prompt} className="font-medium" />
                    <div className="mt-3 space-y-1.5 text-sm">
                      {!r.correct && (
                        <p className="text-red-700 dark:text-red-400">
                          Your answer: {r.selected === -1 ? <em>skipped</em> : <MathText text={q.choices[r.selected]} />}
                        </p>
                      )}
                      <p className="text-emerald-700 dark:text-emerald-400">
                        Correct answer: <MathText text={q.choices[r.correctIndex]} />
                      </p>
                    </div>
                    <p className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                      <MathText text={r.explanation} />
                    </p>
                    <AiTutor key={q.id} mode="explain" questionId={q.id} selected={r.selected} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const question = quiz.questions[current];
  const answeredCount = answers.filter((a) => a !== -1).length;

  return (
    <div className="mx-auto max-w-3xl">
      {header}
      <div className="mb-2 flex justify-between text-sm text-zinc-500">
        <span>
          Question {current + 1} of {total}
        </span>
        <span>{answeredCount} answered</span>
      </div>
      <ProgressBar percent={((current + 1) / total) * 100} />

      <Card className="mt-6 sm:p-8">
        <MathText text={question.prompt} className="block text-lg font-medium leading-relaxed sm:text-xl" />
        <div className="mt-6 grid gap-3">
          {question.choices.map((choice, i) => {
            const selected = answers[current] === i;
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                className={`flex items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
                }`}
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${selected ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                  {LETTERS[i]}
                </span>
                <MathText text={choice} />
              </button>
            );
          })}
        </div>
        <AiTutor key={question.id} mode="hint" questionId={question.id} />
      </Card>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button className={buttonStyles.secondary} onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="hidden gap-1.5 sm:flex">
          {quiz.questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrent(i)}
              aria-label={`Go to question ${i + 1}`}
              className={`size-2.5 rounded-full transition ${i === current ? 'bg-indigo-600 ring-4 ring-indigo-600/20' : answers[i] !== -1 ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            />
          ))}
        </div>
        {isLast ? (
          <button className={buttonStyles.primary} onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Submit {answeredCount < total && `(${total - answeredCount} skipped)`}
          </button>
        ) : (
          <button className={buttonStyles.primary} onClick={() => setCurrent((c) => c + 1)}>
            Next <ArrowRight className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">Tip: press 1–4 to answer and → to continue.</p>
    </div>
  );
}
