import { Router } from 'express';
import { z } from 'zod';
import { Product, Category } from '../db';
import { recordEvent } from '../services/recs';

const router = Router();

function getSessionId(req: any) {
  return (req.headers['x-session-id'] as string) || undefined;
}

function getUserId(req: any) {
  return (req.user && req.user.userId) || (req.headers['x-user-id'] as string) || undefined;
}

function withImageFallback<T extends any>(doc: any) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!obj.images || obj.images.length === 0) {
    obj.images = [`https://picsum.photos/seed/${obj._id}/600/600`];
  }
  return obj;
}

router.get('/products', async (req, res) => {
  const schema = z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    sort: z.enum(['price', 'popular']).optional(),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    userId: z.string().optional(),
  });

  const parse = schema.safeParse(req.query);
  if (!parse.success)
    return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });

  const { search, category, sort, page = 1, limit = 12, userId: queryUserId } = parse.data;
  const sessionId = getSessionId(req);
  const userId = getUserId(req) ?? queryUserId;

  const filter: Record<string, any> = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (category) filter.categoryId = category;

  let query = Product.find(filter).skip((page - 1) * limit).limit(limit);
  if (sort === 'price') query = query.sort({ price: 1 });
  if (sort === 'popular') query = query.sort({ stock: 1 });

  const [items, total] = await Promise.all([query.exec(), Product.countDocuments(filter)]);
  const itemsWithImages = items.map(withImageFallback);

  if (sessionId && itemsWithImages.length) {
    await recordEvent({
      sessionId,
      userId,
      productIdList: itemsWithImages.map((item) => String(item._id)),
      eventType: search ? 'view' : 'impression',
    });
  }

  res.json({ items: itemsWithImages, total, page, limit });
});

router.get('/products/:id', async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'NOT_FOUND' });
  const product = withImageFallback(p);
  const sessionId = getSessionId(req);
  const userId = getUserId(req);
  if (sessionId) {
    await recordEvent({ sessionId, userId, productIdList: [String(product._id)], eventType: 'view' });
  }
  res.json(product);
});

router.get('/products/slug/:slug', async (req, res) => {
  const p = await Product.findOne({ slug: req.params.slug });
  if (!p) return res.status(404).json({ error: 'NOT_FOUND' });
  const product = withImageFallback(p);
  const sessionId = getSessionId(req);
  const userId = getUserId(req);
  if (sessionId) {
    await recordEvent({ sessionId, userId, productIdList: [String(product._id)], eventType: 'view' });
  }
  res.json(product);
});

router.get('/categories', async (_req, res) => {
  const cats = await Category.find({}).exec();
  res.json(cats);
});

export default router;
