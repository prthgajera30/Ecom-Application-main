
import { Router } from 'express';
import { z } from 'zod';
import { Session, Product } from '../db';
import { recordEvent, fetchRecommendationsWithProducts } from '../services/recs';

const router = Router();

type VariantPayload = {
  variantId?: string;
  variantLabel?: string;
  variantOptions?: Record<string, string>;
  unitPrice?: number;
};

function getSessionId(req: any) {
  return (req.headers['x-session-id'] as string) || 'anon';
}

function getUserId(req: any) {
  return (req.user && req.user.userId) || undefined;
}

function attachUser(session: any, userId?: string) {
  if (session && userId && session.userId !== userId) {
    session.userId = userId;
  }
}

function buildLineKey(item: { productId: string; variantId?: string }) {
  const productId = String(item.productId);
  const variantId = item.variantId ? String(item.variantId) : 'default';
  return `${productId}::${variantId}`;
}

function normalizeCart(cart: any) {
  const map = new Map<string, any>();
  for (const rawItem of cart.items || []) {
    const productId = String(rawItem.productId);
    const qty = Math.max(0, Number(rawItem.qty || 0));
    if (!productId || qty <= 0) continue;
    const variantId = rawItem.variantId ? String(rawItem.variantId) : undefined;
    const key = buildLineKey({ productId, variantId });
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      map.set(key, {
        productId,
        qty,
        variantId,
        variantLabel: rawItem.variantLabel ? String(rawItem.variantLabel) : undefined,
        variantOptions: rawItem.variantOptions && typeof rawItem.variantOptions === 'object' ? rawItem.variantOptions : undefined,
        unitPrice: Number.isFinite(Number(rawItem.unitPrice)) ? Number(rawItem.unitPrice) : undefined,
      });
    }
  }
  cart.items = Array.from(map.values());
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

async function fetchProductMap(productIds: string[]) {
  if (!productIds.length) return {} as Record<string, any>;
  const products = await Product.find({ _id: { $in: productIds } }).exec();
  const map: Record<string, any> = {};
  for (const doc of products) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (!obj.images || obj.images.length === 0) {
      obj.images = [`https://picsum.photos/seed/${obj._id}/600/600`];
    }
    map[String(obj._id)] = obj;
  }
  return map;
}

function resolveVariant(product: any, payload: VariantPayload) {
  const variantId = payload.variantId ? String(payload.variantId) : undefined;
  const variant = variantId ? product?.variants?.find((v: any) => String(v.variantId) === variantId) : undefined;
  const label = payload.variantLabel || variant?.label;
  const options = payload.variantOptions || variant?.options;
  const unitPrice = payload.unitPrice ?? variant?.price ?? product?.price ?? 0;
  return { variantId, variant, label, options, unitPrice: Number(unitPrice) };
}

async function buildCartResponse(sessionId: string) {
  const session = await Session.findOne({ sessionId });
  const cart = normalizeCart(session?.cart || { items: [] });
  const productIds = Array.from(new Set(cart.items.map((item: any) => item.productId)));
  const productMap = await fetchProductMap(productIds);

  for (const item of cart.items) {
    const product = productMap[item.productId];
    if (!product) continue;
    const { variant, label, options, unitPrice } = resolveVariant(product, item);
    if (variant && !item.variantId) {
      item.variantId = String(variant.variantId);
    }
    if (label && !item.variantLabel) item.variantLabel = label;
    if (options && !item.variantOptions) item.variantOptions = options;
    if (variant?.images?.length && !item.variantImage) {
      item.variantImage = variant.images[0];
    }
    if (!Number.isFinite(item.unitPrice)) {
      item.unitPrice = unitPrice;
    }
  }

  return { items: cart.items, products: productMap };
}

router.get('/cart', async (req, res) => {
  const sessionId = getSessionId(req);
  const response = await buildCartResponse(sessionId);
  res.json(response);
});

const addSchema = z.object({
  productId: z.string(),
  qty: z.number().min(1).default(1),
  variantId: z.string().optional(),
  variantLabel: z.string().optional(),
  variantOptions: z.record(z.string()).optional(),
});

router.post('/cart/add', async (req, res) => {
  const parse = addSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { productId, qty, variantId, variantLabel, variantOptions } = parse.data;

  const sessionId = getSessionId(req);
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: 'NOT_FOUND' });
  const userId = getUserId(req);

  const { variant, label, options, unitPrice } = resolveVariant(product, { variantId, variantLabel, variantOptions });
  if (variantId && !variant) {
    return res.status(400).json({ error: 'INVALID_VARIANT', message: 'That product variant is unavailable.' });
  }

  let session = await Session.findOne({ sessionId });
  if (!session) {
    session = await Session.create({
      sessionId,
      userId,
      cart: {
        items: [
          {
            productId,
            qty,
            variantId: variant?.variantId || variantId,
            variantLabel: label,
            variantOptions: options,
            unitPrice,
          },
        ],
      },
      updatedAt: new Date(),
    });
  } else {
    const items = session.cart?.items || [];
    const existing = items.find((i: any) => i.productId === productId && (i.variantId || 'default') === (variant?.variantId || variantId || 'default'));
    if (existing) {
      existing.qty += qty;
      if (label) existing.variantLabel = label;
      if (options) existing.variantOptions = options;
      existing.unitPrice = unitPrice;
    } else {
      items.push({
        productId,
        qty,
        variantId: variant?.variantId || variantId,
        variantLabel: label,
        variantOptions: options,
        unitPrice,
      });
    }
    session.cart.items = items;
    attachUser(session, userId);
    session.updatedAt = new Date();
    normalizeCart(session.cart);
    await session.save();
  }

  await recordEvent({ sessionId, userId, productIdList: [productId], eventType: 'add_to_cart' });
  req.app.get('io').to('inventory').emit('cart:updated', session?.cart);
  const response = await buildCartResponse(sessionId);
  await emitCartNudge(req, { sessionId, userId, productId });
  res.json(response);
});

const updateSchema = z.object({
  productId: z.string(),
  qty: z.number().min(0),
  variantId: z.string().optional(),
});

async function handleUpdate(req: any, res: any) {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { productId, qty, variantId } = parse.data;
  const sessionId = getSessionId(req);
  const session = await Session.findOne({ sessionId });
  const userId = getUserId(req);
  if (!session) return res.json({ items: [], products: {} });
  attachUser(session, userId);

  const keyMatcher = (item: any) => item.productId === productId && (item.variantId || 'default') === (variantId || 'default');

  if (qty === 0) {
    session.cart.items = session.cart.items.filter((i: any) => !keyMatcher(i));
  } else {
    let line = session.cart.items.find(keyMatcher);
    if (!line) {
      line = { productId, qty: 0 };
      session.cart.items.push(line);
    }
    line.qty = qty;
    line.variantId = variantId;

    const product = await Product.findById(productId);
    if (product) {
      const { variant, unitPrice, label, options } = resolveVariant(product, { variantId });
      if (variant) line.variantId = String(variant.variantId);
      if (label) line.variantLabel = label;
      if (options) line.variantOptions = options;
      line.unitPrice = unitPrice;
    }
  }

  session.updatedAt = new Date();
  normalizeCart(session.cart);
  await session.save();
  await recordEvent({ sessionId, userId, productIdList: [productId], eventType: qty === 0 ? 'remove_from_cart' : 'add_to_cart' });
  const response = await buildCartResponse(sessionId);
  await emitCartNudge(req, { sessionId, userId, productId });
  res.json(response);
}

router.post('/cart/update', handleUpdate);
router.post('/cart/update-qty', handleUpdate);
router.put('/cart/update', handleUpdate);

router.post('/cart/remove', async (req, res) => {
  const schema = z.object({ productId: z.string(), variantId: z.string().optional() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION' });
  const { productId, variantId } = parse.data;
  const sessionId = getSessionId(req);
  const session = await Session.findOne({ sessionId });
  const userId = getUserId(req);
  if (!session) return res.json({ items: [], products: {} });
  attachUser(session, userId);
  session.cart.items = session.cart.items.filter((i: any) => !(i.productId === productId && (i.variantId || 'default') === (variantId || 'default')));
  session.updatedAt = new Date();
  await session.save();
  await recordEvent({ sessionId, userId, productIdList: [productId], eventType: 'remove_from_cart' });
  const response = await buildCartResponse(sessionId);
  await emitCartNudge(req, { sessionId, userId, productId });
  res.json(response);
});

export default router;
