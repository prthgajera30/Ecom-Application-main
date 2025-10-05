import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

router.get('/orders', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId as string;
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders.map((order) => ({ ...order, items: [] })));
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId as string;
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ...order, items: [] });
});

export default router;
