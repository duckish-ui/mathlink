import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { emitActivity } from '../lib/events.js';
import { prisma } from '../lib/prisma.js';
import { awardXp } from '../lib/xp.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  const topic = typeof req.query.topic === 'string' ? req.query.topic : undefined;
  const quizzes = await prisma.quiz.findMany({
    where: topic ? { topic: { slug: topic } } : {},
    include: {
      topic: true,
      _count: { select: { questions: true } },
      attempts: { where: { userId: req.userId ?? '' }, orderBy: { score: 'desc' }, take: 1 },
    },
    orderBy: [{ topic: { order: 'asc' } }, { xpReward: 'asc' }],
  });

  res.json(
    quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      xpReward: q.xpReward,
      questionCount: q._count.questions,
      topic: { id: q.topic.id, slug: q.topic.slug, name: q.topic.name, color: q.topic.color },
      bestScore: q.attempts[0]?.score ?? null,
    })),
  );
});

// Answers and explanations are never sent here — grading happens on the server.
router.get('/:id', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: String(req.params.id) },
    include: { topic: true, questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found.');

  res.json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    difficulty: quiz.difficulty,
    xpReward: quiz.xpReward,
    topic: { id: quiz.topic.id, slug: quiz.topic.slug, name: quiz.topic.name, color: quiz.topic.color },
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      choices: q.choices,
    })),
  });
});

const submitSchema = z.object({
  // -1 means the question was skipped
  answers: z.array(z.number().int().min(-1)),
});

router.post('/:id/submit', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { answers } = submitSchema.parse(req.body);
  const quiz = await prisma.quiz.findUnique({
    where: { id: String(req.params.id) },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found.');
  if (answers.length !== quiz.questions.length) {
    throw new HttpError(400, `Expected ${quiz.questions.length} answers.`);
  }

  const results = quiz.questions.map((q, i) => ({
    questionId: q.id,
    selected: answers[i],
    correctIndex: q.answerIndex,
    correct: answers[i] === q.answerIndex,
    explanation: q.explanation,
  }));
  const score = results.filter((r) => r.correct).length;
  const total = quiz.questions.length;

  // Only award XP for improving on your previous best, so retakes can't be farmed.
  const previousBest = await prisma.quizAttempt.findFirst({
    where: { userId, quizId: quiz.id },
    orderBy: { score: 'desc' },
  });
  const xpFor = (s: number) => Math.round((quiz.xpReward * s) / total);
  const xpEarned = Math.max(0, xpFor(score) - xpFor(previousBest?.score ?? 0));

  await prisma.quizAttempt.create({ data: { userId, quizId: quiz.id, score, total, xpEarned } });
  if (xpEarned > 0) await awardXp(userId, xpEarned, `Scored ${score}/${total} on "${quiz.title}"`);
  if (score === total) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (user) emitActivity(`${user.name} aced “${quiz.title}”`, userId);
  }

  res.json({ score, total, xpEarned, previousBest: previousBest?.score ?? null, results });
});

export default router;
