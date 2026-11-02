import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { emitActivity, emitSessionChanged } from '../lib/events.js';
import { prisma } from '../lib/prisma.js';
import { awardXp, revokeXp } from '../lib/xp.js';

const router = Router();

const JOIN_XP = 15;
const HOST_XP = 25;
const MINUTE = 60 * 1000;

const sessionInclude = (userId?: string) => ({
  topic: true,
  host: { select: { id: true, name: true } },
  _count: { select: { attendees: true } },
  // Only the current user's attendee row, so we can tell whether they've joined.
  attendees: { where: { userId: userId ?? '' }, select: { userId: true } },
});

function findSessions(where: object, userId?: string, order: 'asc' | 'desc' = 'asc') {
  return prisma.session.findMany({ where, include: sessionInclude(userId), orderBy: { startsAt: order } });
}

type SessionRow = Awaited<ReturnType<typeof findSessions>>[number];

function toDto(s: SessionRow, now = new Date()) {
  const endsAt = new Date(s.startsAt.getTime() + s.durationMin * MINUTE);
  const status = now < s.startsAt ? 'upcoming' : now < endsAt ? 'live' : 'ended';
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    startsAt: s.startsAt,
    endsAt,
    durationMin: s.durationMin,
    capacity: s.capacity,
    attendeeCount: s._count.attendees,
    status,
    joined: s.attendees.length > 0,
    topic: { id: s.topic.id, slug: s.topic.slug, name: s.topic.name, color: s.topic.color },
    host: s.host,
  };
}

const listQuery = z.object({
  topic: z.string().optional(),
  scope: z.enum(['upcoming', 'mine', 'past']).default('upcoming'),
});

router.get('/', optionalAuth, async (req, res) => {
  const { topic, scope } = listQuery.parse(req.query);
  const now = new Date();
  // Sessions last at most 4 hours, so anything that started before this has ended.
  const recentCutoff = new Date(now.getTime() - 240 * MINUTE);

  const where = {
    ...(topic ? { topic: { slug: topic } } : {}),
    ...(scope === 'past' ? { startsAt: { lt: now } } : { startsAt: { gte: recentCutoff } }),
    ...(scope === 'mine' ? { attendees: { some: { userId: req.userId ?? '' } } } : {}),
  };

  const rows = await findSessions(where, req.userId, scope === 'past' ? 'desc' : 'asc');
  const sessions = rows
    .map((s) => toDto(s, now))
    .filter((s) => (scope === 'past' ? s.status === 'ended' : s.status !== 'ended'));
  res.json(sessions);
});

router.get('/:id', optionalAuth, async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: String(req.params.id) },
    include: {
      ...sessionInclude(req.userId),
      attendees: {
        select: { userId: true, user: { select: { id: true, name: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!session) throw new HttpError(404, 'Session not found.');

  const dto = toDto({ ...session, attendees: session.attendees.filter((a) => a.userId === req.userId) });
  res.json({
    ...dto,
    lesson: session.lesson,
    // The meeting link is only revealed to people who have joined.
    meetingUrl: dto.joined ? session.meetingUrl : null,
    attendees: session.attendees.map((a) => a.user),
  });
});

const createSchema = z.object({
  title: z.string().trim().min(4).max(80),
  description: z.string().trim().min(10).max(300),
  topicId: z.string().min(1),
  startsAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'Start time must be in the future'),
  durationMin: z.coerce.number().int().min(15).max(240),
  capacity: z.coerce.number().int().min(2).max(100),
  lesson: z.string().max(5000).default(''),
  meetingUrl: z.union([z.url(), z.literal('')]).optional(),
});

router.post('/', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const data = createSchema.parse(req.body);
  const topic = await prisma.topic.findUnique({ where: { id: data.topicId } });
  if (!topic) throw new HttpError(400, 'Unknown topic.');

  const session = await prisma.session.create({
    data: {
      ...data,
      meetingUrl: data.meetingUrl || null,
      hostId: userId,
      attendees: { create: { userId } },
    },
  });
  await awardXp(userId, HOST_XP, `Hosted "${session.title}"`, `session:${session.id}`);
  emitSessionChanged(session.id);
  const host = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (host) emitActivity(`${host.name} is hosting “${session.title}”`, userId);
  res.status(201).json({ id: session.id, xpEarned: HOST_XP });
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const session = await prisma.session.findUnique({
    where: { id: String(req.params.id) },
    include: { _count: { select: { attendees: true } }, attendees: { where: { userId } } },
  });
  if (!session) throw new HttpError(404, 'Session not found.');
  if (session.attendees.length > 0) throw new HttpError(409, 'You already joined this session.');
  if (Date.now() > session.startsAt.getTime() + session.durationMin * MINUTE) {
    throw new HttpError(400, 'This session has already ended.');
  }
  if (session._count.attendees >= session.capacity) throw new HttpError(400, 'This session is full.');

  await prisma.sessionAttendee.create({ data: { userId, sessionId: session.id } });
  await awardXp(userId, JOIN_XP, `Joined "${session.title}"`, `session:${session.id}`);
  emitSessionChanged(session.id);
  res.json({ xpEarned: JOIN_XP });
});

router.delete('/:id/join', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const session = await prisma.session.findUnique({ where: { id: String(req.params.id) } });
  if (!session) throw new HttpError(404, 'Session not found.');
  if (session.hostId === userId) throw new HttpError(400, "Hosts can't leave their own session.");

  const { count } = await prisma.sessionAttendee.deleteMany({ where: { userId, sessionId: session.id } });
  if (count === 0) throw new HttpError(400, "You haven't joined this session.");
  await revokeXp(userId, `session:${session.id}`);
  emitSessionChanged(session.id);
  res.status(204).end();
});

export default router;
