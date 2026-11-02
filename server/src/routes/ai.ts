import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

/**
 * AI tutor backed by Groq's OpenAI-compatible chat API. The key lives only on
 * the server (GROQ_API_KEY), so it never ships to the browser.
 */
const router = Router();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

const SYSTEM = `You are MathLink's friendly math tutor for high-school and early college students.
Write math in LaTeX between single dollar signs, e.g. $x^2 + 1$. Never use \\( \\) or \\[ \\].
Use short paragraphs or a short numbered list. No markdown headings, no bold.`;

// Per-user limit so one account can't burn through the API quota.
const limiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  keyGenerator: (req) => req.userId ?? 'anon',
  message: { error: 'You have asked the tutor a lot recently. Try again in a few minutes.' },
});

const cache = new Map<string, string>();

async function askGroq(prompt: string, maxTokens: number) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new HttpError(503, 'The AI tutor is not configured on this server.');

  const cached = cache.get(prompt);
  if (cached) return cached;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error('Groq error', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, 'The AI tutor is unavailable right now.');
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new HttpError(502, 'The AI tutor returned an empty answer.');
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(prompt, text);
  return text;
}

async function loadQuestion(id: string) {
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) throw new HttpError(404, 'Question not found.');
  return q;
}

const letter = (i: number) => String.fromCharCode(65 + i);
const listChoices = (choices: string[]) => choices.map((c, i) => `${letter(i)}) ${c}`).join('\n');

// A nudge during the quiz. The prompt never contains the answer, so the model can't leak it.
router.post('/hint', requireAuth, limiter, async (req, res) => {
  const { questionId } = z.object({ questionId: z.string().min(1) }).parse(req.body);
  const q = await loadQuestion(questionId);
  const text = await askGroq(
    `Give ONE short hint (2-3 sentences) that helps a student start this problem. Do not solve it, do not say which choice is correct, and do not compute the final value.\n\nProblem: ${q.prompt}\nChoices:\n${listChoices(q.choices)}`,
    200,
  );
  res.json({ text });
});

// A step-by-step walkthrough after the quiz, tailored to the answer the student picked.
router.post('/explain', requireAuth, limiter, async (req, res) => {
  const { questionId, selected } = z
    .object({ questionId: z.string().min(1), selected: z.number().int().min(-1) })
    .parse(req.body);
  const q = await loadQuestion(questionId);
  const picked =
    selected >= 0 && selected < q.choices.length
      ? selected === q.answerIndex
        ? `The student correctly chose ${letter(selected)}.`
        : `The student chose ${letter(selected)}) ${q.choices[selected]}, which is wrong. Briefly explain the likely mistake behind that choice.`
      : 'The student skipped this question.';
  const text = await askGroq(
    `Explain step by step how to solve this problem in under 150 words.\n\nProblem: ${q.prompt}\nChoices:\n${listChoices(q.choices)}\nCorrect answer: ${letter(q.answerIndex)}) ${q.choices[q.answerIndex]}\n${picked}`,
    400,
  );
  res.json({ text });
});

export default router;
