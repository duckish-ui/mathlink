import type { User } from '@prisma/client';
import { emitLeaderboardChanged } from './events.js';
import { prisma } from './prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date) {
  const startA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const startB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((startB - startA) / DAY_MS);
}

/** A streak only counts if the user was active today or yesterday. */
export function currentStreak(user: Pick<User, 'streak' | 'lastActiveAt'>, now = new Date()) {
  if (!user.lastActiveAt) return 0;
  return daysBetween(user.lastActiveAt, now) <= 1 ? user.streak : 0;
}

/** Records an XP event, adds it to the user's total and advances their daily streak. */
export async function awardXp(userId: string, amount: number, reason: string, ref?: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const now = new Date();
  const gap = user.lastActiveAt ? daysBetween(user.lastActiveAt, now) : null;
  const streak = gap === 0 ? Math.max(user.streak, 1) : gap === 1 ? user.streak + 1 : 1;

  await prisma.$transaction([
    prisma.xpEvent.create({ data: { userId, amount, reason, ref } }),
    prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: amount }, streak, lastActiveAt: now },
    }),
  ]);
  emitLeaderboardChanged();
}

/** Undoes XP previously awarded with the given ref (e.g. when leaving a session). */
export async function revokeXp(userId: string, ref: string) {
  const events = await prisma.xpEvent.findMany({ where: { userId, ref } });
  const total = events.reduce((sum, e) => sum + e.amount, 0);
  if (events.length === 0) return;
  await prisma.$transaction([
    prisma.xpEvent.deleteMany({ where: { userId, ref } }),
    prisma.user.update({ where: { id: userId }, data: { xp: { decrement: total } } }),
  ]);
  emitLeaderboardChanged();
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    xp: user.xp,
    streak: currentStreak(user),
    createdAt: user.createdAt,
  };
}
