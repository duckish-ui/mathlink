import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { getMastery } from '../lib/stats.js';
import { publicUser } from '../lib/xp.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Account no longer exists.');

  const now = new Date();
  const [rankAbove, quizzesCompleted, sessionsJoined, upcoming, activity, mastery, attemptedIds] =
    await Promise.all([
      prisma.user.count({ where: { xp: { gt: user.xp } } }),
      prisma.quizAttempt.count({ where: { userId } }),
      prisma.sessionAttendee.count({ where: { userId } }),
      prisma.session.findMany({
        where: { attendees: { some: { userId } }, startsAt: { gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) } },
        include: { topic: true, host: { select: { name: true } } },
        orderBy: { startsAt: 'asc' },
        take: 4,
      }),
      prisma.xpEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 6 }),
      getMastery(userId),
      prisma.quizAttempt.findMany({ where: { userId }, select: { quizId: true }, distinct: ['quizId'] }),
    ]);

  // Recommend an untried quiz from the user's weakest topic.
  const weakestFirst = [...mastery].sort((a, b) => a.percent - b.percent).map((m) => m.topic.id);
  const untried = await prisma.quiz.findMany({
    where: { id: { notIn: attemptedIds.map((a) => a.quizId) } },
    include: { topic: true },
  });
  untried.sort((a, b) => weakestFirst.indexOf(a.topicId) - weakestFirst.indexOf(b.topicId));
  const rec = untried[0];

  res.json({
    user: publicUser(user),
    stats: { xp: user.xp, streak: publicUser(user).streak, rank: rankAbove + 1, quizzesCompleted, sessionsJoined },
    mastery,
    upcomingSessions: upcoming
      .filter((s) => s.startsAt.getTime() + s.durationMin * 60 * 1000 > now.getTime())
      .map((s) => ({
        id: s.id,
        title: s.title,
        startsAt: s.startsAt,
        durationMin: s.durationMin,
        host: s.host.name,
        topic: { name: s.topic.name, color: s.topic.color },
      })),
    recentActivity: activity.map((e) => ({ id: e.id, amount: e.amount, reason: e.reason, createdAt: e.createdAt })),
    recommendedQuiz: rec
      ? { id: rec.id, title: rec.title, difficulty: rec.difficulty, xpReward: rec.xpReward, topic: { name: rec.topic.name, color: rec.topic.color } }
      : null,
  });
});

export default router;
