import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { currentStreak } from '../lib/xp.js';

const router = Router();
const LIMIT = 50;

const query = z.object({ range: z.enum(['week', 'all']).default('all') });

router.get('/', optionalAuth, async (req, res) => {
  const { range } = query.parse(req.query);

  if (range === 'all') {
    const users = await prisma.user.findMany({ orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }], take: LIMIT });
    res.json(
      users.map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        name: u.name,
        xp: u.xp,
        streak: currentStreak(u),
        isYou: u.id === req.userId,
      })),
    );
    return;
  }

  const since = new Date(Date.now() - 7 * 86_400_000);
  const totals = await prisma.xpEvent.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: since } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: LIMIT,
  });
  const users = await prisma.user.findMany({ where: { id: { in: totals.map((t) => t.userId) } } });
  const byId = new Map(users.map((u) => [u.id, u]));

  res.json(
    totals
      .filter((t) => (t._sum.amount ?? 0) > 0 && byId.has(t.userId))
      .map((t, i) => {
        const u = byId.get(t.userId)!;
        return {
          rank: i + 1,
          userId: u.id,
          name: u.name,
          xp: t._sum.amount ?? 0,
          streak: currentStreak(u),
          isYou: u.id === req.userId,
        };
      }),
  );
});

export default router;
