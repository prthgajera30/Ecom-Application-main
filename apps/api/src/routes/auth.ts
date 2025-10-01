import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma, Session } from '../db';
import { requireAuth, signToken } from '../middleware/auth';

const router = Router();

const credsSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

type CartItem = { productId: string; qty: number };

function normalizeCartItems(items: any[]): CartItem[] {
  const map = new Map<string, number>();
  for (const entry of items || []) {
    const productId = String(entry?.productId || entry?._id || '');
    const qty = Math.max(0, Number(entry?.qty || 0));
    if (!productId || qty <= 0) continue;
    map.set(productId, (map.get(productId) || 0) + qty);
  }
  return Array.from(map.entries()).map(([productId, qty]) => ({ productId, qty }));
}

async function mergeSessionCart(req: any, userId: string) {
  const sessionId = (req.headers['x-session-id'] as string | undefined)?.trim();
  if (!sessionId || !userId) return;

  const sessions = await Session.find({
    $or: [
      { sessionId },
      { userId },
    ],
  }).exec();

  let current = sessions.find((doc) => doc.sessionId === sessionId) || null;
  const others = sessions.filter((doc) => doc.sessionId !== sessionId && doc.userId === userId);

  if (!current) {
    current = await Session.create({ sessionId, userId, cart: { items: [] }, updatedAt: new Date() });
  }

  const aggregate = new Map<string, number>();
  const collect = (doc: any | null) => {
    if (!doc?.cart?.items) return;
    for (const item of doc.cart.items) {
      const productId = String(item?.productId || '');
      const qty = Math.max(0, Number(item?.qty || 0));
      if (!productId || qty <= 0) continue;
      aggregate.set(productId, (aggregate.get(productId) || 0) + qty);
    }
  };

  collect(current);
  for (const doc of others) collect(doc);

  current.cart = { items: normalizeCartItems(Array.from(aggregate.entries()).map(([productId, qty]) => ({ productId, qty }))) };
  current.userId = userId;
  current.updatedAt = new Date();
  await current.save();

  if (others.length) {
    const idsToRemove = others.filter((doc) => doc.sessionId !== sessionId).map((doc) => doc._id);
    if (idsToRemove.length) await Session.deleteMany({ _id: { $in: idsToRemove } }).exec();
  }
}

router.post('/register', async (req, res) => {
  const parse = credsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { email, password } = parse.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: 'EMAIL_EXISTS' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  await mergeSessionCart(req, user.id);
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
  await mergeSessionCart(req, user.id);
  const token = signToken({ userId: user.id, role: user.role as any });
  res.json({ token });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: (req as any).user.userId }, select: { id: true, email: true, role: true } });
  res.json(user);
});

export default router;
