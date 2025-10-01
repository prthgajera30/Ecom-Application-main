import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

router.get('/orders', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId as string;
  const orders = await prisma.order.findMany({ where: { userId }, include: { items: true, payment: true } });
  res.json(orders);
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId as string;
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId }, include: { items: true, payment: true } });
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(order);
});

export default router;
