import { ChevronLeft, Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lesson } from '../components/MathText';
import { Card, PageHeader, buttonStyles, inputStyles } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { api, errorMessage } from '../lib/api';
import type { Topic } from '../lib/types';

const LESSON_TEMPLATE = String.raw`## Key idea
Write the main concept here. Use $inline math$ or display math:

$$a^2 + b^2 = c^2$$

## Worked example
- Step one
- Step two`;

/** `datetime-local` wants local time without a timezone: YYYY-MM-DDTHH:mm */
function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function NewSession() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const { data: topics } = useApi<Topic[]>('/topics');

  const [form, setForm] = useState({
    title: '',
    topicId: '',
    description: '',
    startsAt: toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    durationMin: '60',
    capacity: '12',
    meetingUrl: '',
    lesson: LESSON_TEMPLATE,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Default the topic select to the first topic once topics have loaded.
  useEffect(() => {
    if (topics && topics.length > 0) setForm((f) => (f.topicId ? f : { ...f, topicId: topics[0].id }));
  }, [topics]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ id: string; xpEarned: number }>('/sessions', {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
      });
      toast(`Session created! +${res.data.xpEarned} XP for hosting`);
      await refreshUser();
      navigate(`/sessions/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link to="/sessions" className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ChevronLeft className="size-4" /> All sessions
      </Link>
      <PageHeader title="Host a study session" subtitle="Hosting earns 25 XP. Lesson notes support LaTeX math between $ signs." />

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Title</span>
            <input className={inputStyles} value={form.title} onChange={set('title')} required minLength={4} maxLength={80} placeholder="e.g. Chain Rule Clinic" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Topic</span>
            <select className={inputStyles} value={form.topicId} onChange={set('topicId')} required>
              {topics?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Short description</span>
            <textarea className={inputStyles} rows={2} value={form.description} onChange={set('description')} required minLength={10} maxLength={300} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-3">
              <span className="mb-1.5 block text-sm font-medium">Starts at</span>
              <input className={inputStyles} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Duration</span>
              <select className={inputStyles} value={form.durationMin} onChange={set('durationMin')}>
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Capacity</span>
              <input className={inputStyles} type="number" min={2} max={100} value={form.capacity} onChange={set('capacity')} required />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Meeting link <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <input className={inputStyles} type="url" value={form.meetingUrl} onChange={set('meetingUrl')} placeholder="https://meet.google.com/…" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Lesson notes</span>
            <textarea className={`${inputStyles} font-mono text-xs`} rows={10} value={form.lesson} onChange={set('lesson')} maxLength={5000} />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
          <button className={`${buttonStyles.primary} w-full py-3`} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Create session
          </button>
        </Card>

        <Card className="h-fit lg:sticky lg:top-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Live preview</h2>
          <h3 className="text-xl font-bold">{form.title || 'Your session title'}</h3>
          <p className="mt-1 mb-6 text-sm text-zinc-500">{form.description || 'A short description of what you will cover.'}</p>
          <Lesson source={form.lesson} />
        </Card>
      </form>
    </div>
  );
}
