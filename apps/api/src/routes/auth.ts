import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { requireAuth, signToken } from '../middleware/auth';

const router = Router();

const credsSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/register', async (req, res) => {
  const parse = credsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { email, password } = parse.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: 'EMAIL_EXISTS' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const token = signToken({ userId: user.id, role: user.role as any });
  res.json({ token });
});

router.post('/login', async (req, res) => {
  const parse = credsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { email, password } = parse.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  const token = signToken({ userId: user.id, role: user.role as any });
  res.json({ token });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: (req as any).user.userId }, select: { id: true, email: true, role: true } });
  res.json(user);
});

export default router;
