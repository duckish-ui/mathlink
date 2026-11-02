import { prisma } from './prisma.js';

/**
 * Mastery per topic = sum of the user's best score on each quiz in the topic
 * divided by the total number of questions in that topic. Quizzes not yet
 * attempted count as zero, so mastery grows as you cover more material.
 */
export async function getMastery(userId: string) {
  const [topics, attempts] = await Promise.all([
    prisma.topic.findMany({
      orderBy: { order: 'asc' },
      include: { quizzes: { include: { _count: { select: { questions: true } } } } },
    }),
    prisma.quizAttempt.findMany({ where: { userId }, select: { quizId: true, score: true } }),
  ]);

  const best = new Map<string, number>();
  for (const a of attempts) best.set(a.quizId, Math.max(best.get(a.quizId) ?? 0, a.score));

  return topics.map((topic) => {
    const totalQuestions = topic.quizzes.reduce((sum, q) => sum + q._count.questions, 0);
    const earned = topic.quizzes.reduce((sum, q) => sum + (best.get(q.id) ?? 0), 0);
    return {
      topic: { id: topic.id, slug: topic.slug, name: topic.name, color: topic.color },
      percent: totalQuestions === 0 ? 0 : Math.round((earned / totalQuestions) * 100),
      quizzesTaken: topic.quizzes.filter((q) => best.has(q.id)).length,
      quizzesTotal: topic.quizzes.length,
    };
  });
}
