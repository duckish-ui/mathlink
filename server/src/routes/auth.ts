import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, signToken } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { publicUser } from '../lib/xp.js';

const router = Router();

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(40),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

const loginSchema = z.object({ email, password: z.string().min(1) });

router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, 'An account with that email already exists.');

  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 10) },
  });
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  res.json({ user: publicUser(user) });
});

export default router;
