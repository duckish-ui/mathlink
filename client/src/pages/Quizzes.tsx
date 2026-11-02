import { ArrowRight, CheckCircle2, HelpCircle, Zap } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, DifficultyBadge, EmptyState, ErrorState, FilterChips, LoadingState, PageHeader, ProgressBar, TopicBadge, buttonStyles } from '../components/ui';
import { useApi } from '../hooks/useApi';
import type { QuizSummary, Topic } from '../lib/types';

export default function Quizzes() {
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? 'all';
  const { data: topics } = useApi<Topic[]>('/topics');
  const { data: quizzes, error, loading, refetch } = useApi<QuizSummary[]>(topic === 'all' ? '/quizzes' : `/quizzes?topic=${topic}`);

  return (
    <div>
      <PageHeader title="Quizzes" subtitle="Graded instantly with explanations. You earn XP each time you beat your best score." />

      <div className="mb-6">
        <FilterChips
          options={[{ value: 'all', label: 'All topics' }, ...(topics ?? []).map((t) => ({ value: t.slug, label: t.name, color: t.color }))]}
          value={topic}
          onChange={(v) => setParams(v === 'all' ? {} : { topic: v }, { replace: true })}
        />
      </div>

      {loading && !quizzes ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : quizzes?.length === 0 ? (
        <EmptyState title="No quizzes for this topic yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes?.map((q) => {
            const mastered = q.bestScore === q.questionCount;
            return (
              <Card key={q.id} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <TopicBadge topic={q.topic} />
                  <DifficultyBadge difficulty={q.difficulty} />
                </div>
                <h2 className="mt-3 text-lg font-semibold">{q.title}</h2>
                <p className="mt-1 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{q.description}</p>

                <div className="mt-4 flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="size-4" /> {q.questionCount} questions
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="size-4" /> {q.xpReward} XP
                  </span>
                </div>

                {q.bestScore !== null && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Best score</span>
                      <span className="flex items-center gap-1 font-semibold tabular-nums">
                        {mastered && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                        {q.bestScore}/{q.questionCount}
                      </span>
                    </div>
                    <ProgressBar percent={(q.bestScore / q.questionCount) * 100} />
                  </div>
                )}

                <Link to={`/quizzes/${q.id}`} className={`${q.bestScore === null ? buttonStyles.primary : buttonStyles.secondary} mt-5`}>
                  {q.bestScore === null ? 'Start quiz' : mastered ? 'Practice again' : 'Improve score'}
                  <ArrowRight className="size-4" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
