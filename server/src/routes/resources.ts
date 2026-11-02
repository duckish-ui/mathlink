import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res) => {
  const topic = typeof req.query.topic === 'string' ? req.query.topic : undefined;
  const resources = await prisma.resource.findMany({
    where: topic ? { topic: { slug: topic } } : {},
    include: { topic: true },
    orderBy: [{ topic: { order: 'asc' } }, { title: 'asc' }],
  });
  res.json(
    resources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
      type: r.type,
      topic: { slug: r.topic.slug, name: r.topic.name, color: r.topic.color },
    })),
  );
});

export default router;
