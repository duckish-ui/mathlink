import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { getMastery } from '../lib/stats.js';

const router = Router();
const DAYS = 30;

router.get('/', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Account no longer exists.');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - (DAYS - 1) * 86_400_000);

  const [events, attempts, mastery] = await Promise.all([
    prisma.xpEvent.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
    prisma.quizAttempt.findMany({
      where: { userId },
      include: { quiz: { include: { topic: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    getMastery(userId),
  ]);

  // Build a cumulative XP line: start from the XP the user had before the window.
  const daily = new Map<string, number>();
  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + e.amount);
  }
  let running = user.xp - events.reduce((sum, e) => sum + e.amount, 0);
  const xpTimeline = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const gained = daily.get(date) ?? 0;
    running += gained;
    return { date, gained, total: running };
  });

  const correct = attempts.reduce((sum, a) => sum + a.score, 0);
  const answered = attempts.reduce((sum, a) => sum + a.total, 0);

  res.json({
    xpTimeline,
    mastery,
    accuracy: answered === 0 ? null : Math.round((correct / answered) * 100),
    totalAttempts: attempts.length,
    attempts: attempts.slice(0, 15).map((a) => ({
      id: a.id,
      quizId: a.quizId,
      quizTitle: a.quiz.title,
      topic: { name: a.quiz.topic.name, color: a.quiz.topic.color },
      score: a.score,
      total: a.total,
      xpEarned: a.xpEarned,
      createdAt: a.createdAt,
    })),
  });
});

export default router;
