import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  const topics = await prisma.topic.findMany({ orderBy: { order: 'asc' } });
  res.json(topics);
});

export default router;
