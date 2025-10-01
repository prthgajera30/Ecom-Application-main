import { Router } from 'express';
import { z } from 'zod';
import { Session, Product } from '../db';
import { recordEvent, fetchRecommendationsWithProducts } from '../services/recs';

const router = Router();

function getSessionId(req: any) {
  return (req.headers['x-session-id'] as string) || 'anon';
}

function getUserId(req: any) {
  return (req.user && req.user.userId) || undefined;
}

function normalizeCart(cart: any) {
  const map = new Map<string, number>();
  for (const it of cart.items || []) {
    map.set(it.productId, (map.get(it.productId) || 0) + Number(it.qty || 0));
  }
  cart.items = Array.from(map.entries()).map(([productId, qty]) => ({ productId, qty }));
  return cart;
}


async function emitCartNudge(req: any, { sessionId, userId, productId }: { sessionId?: string; userId?: string; productId?: string }) {
  if (!sessionId) return;
  const io = req.app.get('io');
  if (!io) return;
  try {
    const items = await fetchRecommendationsWithProducts({ userId, productId, k: 3 });
    if (!items.length) return;
    const payload = { items };
    io.to(`session:${sessionId}`).emit('reco:nudge', payload);
    if (userId) io.to(`user:${userId}`).emit('reco:nudge', payload);
  } catch (err) {
    console.warn('Failed to emit recommendation nudge', err);
  }
}

async function buildCartResponse(sessionId: string) {
  const session = await Session.findOne({ sessionId });
  const cart = normalizeCart(session?.cart || { items: [] });
  const productIds = cart.items.map((item: any) => item.productId);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).exec()
    : [];
  const productMap: Record<string, any> = {};
  for (const doc of products) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (!obj.images || obj.images.length === 0) {
      obj.images = [`https://picsum.photos/seed/${obj._id}/600/600`];
    }
    productMap[String(obj._id)] = obj;
  }
  return { items: cart.items, products: productMap };
}

router.get('/cart', async (req, res) => {
  const sessionId = getSessionId(req);
  const response = await buildCartResponse(sessionId);
  res.json(response);
});

router.post('/cart/add', async (req, res) => {
  const schema = z.object({ productId: z.string(), qty: z.number().min(1).default(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { productId, qty } = parse.data;
  const sessionId = getSessionId(req);
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: 'NOT_FOUND' });
  const userId = getUserId(req);
  let session = await Session.findOne({ sessionId });
  if (!session) {
    session = await Session.create({ sessionId, cart: { items: [{ productId, qty }] }, updatedAt: new Date() });
  } else {
    const existing = session.cart?.items?.find((i: any) => i.productId === productId);
    if (existing) existing.qty += qty; else session.cart.items.push({ productId, qty });
    session.updatedAt = new Date();
    normalizeCart(session.cart);
    await session.save();
  }
  await recordEvent({ sessionId, userId, productIdList: [productId], eventType: 'add_to_cart' });
  req.app.get('io').to('inventory').emit('cart:updated', session.cart);
  const response = await buildCartResponse(sessionId);
  await emitCartNudge(req, { sessionId, userId, productId });
  res.json(response);
});

const updateSchema = z.object({ productId: z.string(), qty: z.number().min(0) });

async function handleUpdate(req: any, res: any) {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { productId, qty } = parse.data;
  const sessionId = getSessionId(req);
  const session = await Session.findOne({ sessionId });
  const userId = getUserId(req);
  if (!session) return res.json({ items: [], products: {} });
  let eventType: 'add_to_cart' | 'remove_from_cart' = 'add_to_cart';
  if (qty === 0) {
    session.cart.items = session.cart.items.filter((i: any) => i.productId !== productId);
    eventType = 'remove_from_cart';
  } else {
    const it = session.cart.items.find((i: any) => i.productId === productId);
    if (it) it.qty = qty; else session.cart.items.push({ productId, qty });
  }
  session.updatedAt = new Date();
  normalizeCart(session.cart);
  await session.save();
  await recordEvent({ sessionId, userId, productIdList: [productId], eventType });
  const response = await buildCartResponse(sessionId);
  await emitCartNudge(req, { sessionId, userId, productId });
  res.json(response);
}

router.post('/cart/update', handleUpdate);
router.post('/cart/update-qty', handleUpdate);
router.put('/cart/update', handleUpdate);

router.post('/cart/remove', async (req, res) => {
  const schema = z.object({ productId: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION' });
  const { productId } = parse.data;
  const sessionId = getSessionId(req);
  const session = await Session.findOne({ sessionId });
  const userId = getUserId(req);
  if (!session) return res.json({ items: [], products: {} });
  session.cart.items = session.cart.items.filter((i: any) => i.productId !== productId);
  session.updatedAt = new Date();
  await session.save();
  await recordEvent({ sessionId, userId, productIdList: [productId], eventType: 'remove_from_cart' });
  const response = await buildCartResponse(sessionId);
  await emitCartNudge(req, { sessionId, userId, productId });
  res.json(response);
});

export default router;
