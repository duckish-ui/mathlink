import { prisma } from './prisma.js';

export interface BankQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  topicSlug: string;
}

// The question bank is small and read-only at runtime, so live polls and battles
// read it from memory instead of hitting the database on every round.
let cache: Promise<BankQuestion[]> | null = null;

function loadBank(): Promise<BankQuestion[]> {
  cache ??= prisma.question
    .findMany({ include: { quiz: { select: { topic: { select: { slug: true } } } } } })
    .then((rows) =>
      rows.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        topicSlug: q.quiz.topic.slug,
      })),
    )
    .catch((err: unknown) => {
      cache = null;
      throw err;
    });
  return cache!;
}

/** Picks `count` distinct random questions, from one topic when given. */
export async function randomQuestions(count: number, topicSlug?: string | null) {
  const bank = await loadBank();
  const pool = topicSlug ? bank.filter((q) => q.topicSlug === topicSlug) : bank;
  const shuffled = [...(pool.length >= count ? pool : bank)];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
