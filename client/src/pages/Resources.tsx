import { BookOpen, ExternalLink, FileText, GraduationCap, MousePointerClick, PlayCircle } from 'lucide-react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import Calculator from '../components/Calculator';
import { Card, ErrorState, FilterChips, LoadingState, PageHeader, TopicBadge } from '../components/ui';
import { useApi } from '../hooks/useApi';
import type { Resource, Topic } from '../lib/types';

const typeIcons: Record<string, ComponentType<{ className?: string }>> = {
  Video: PlayCircle,
  Course: GraduationCap,
  Book: BookOpen,
  Interactive: MousePointerClick,
  Notes: FileText,
};

export default function Resources() {
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? 'all';
  const { data: topics } = useApi<Topic[]>('/topics');
  const { data: resources, error, loading, refetch } = useApi<Resource[]>(topic === 'all' ? '/resources' : `/resources?topic=${topic}`);

  return (
    <div>
      <PageHeader title="Resources" subtitle="Hand-picked free courses, books and tools, plus a calculator that handles derivatives and matrices." />

      <Calculator />

      <div className="mb-6 mt-10">
        <FilterChips
          options={[{ value: 'all', label: 'All topics' }, ...(topics ?? []).map((t) => ({ value: t.slug, label: t.name, color: t.color }))]}
          value={topic}
          onChange={(v) => setParams(v === 'all' ? {} : { topic: v }, { replace: true })}
        />
      </div>

      {loading && !resources ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources?.map((r) => {
            const Icon = typeIcons[r.type] ?? FileText;
            return (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="group">
                <Card className="flex h-full flex-col transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      <Icon className="size-4" /> {r.type}
                    </span>
                    <ExternalLink className="size-4 text-zinc-400 group-hover:text-indigo-500" />
                  </div>
                  <h2 className="mt-3 font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{r.title}</h2>
                  <p className="mt-1 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{r.description}</p>
                  <div className="mt-4">
                    <TopicBadge topic={r.topic} />
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
