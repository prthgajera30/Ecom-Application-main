import { Router } from 'express';
import { z } from 'zod';
import { Product } from '../db';

const router = Router();

const submissionSchema = z
  .object({
    rating: z.number().min(1).max(5),
    title: z.string().max(120).optional(),
    body: z.string().max(2000).optional(),
    author: z
      .object({
        name: z.string().max(80).optional(),
        email: z.string().email().optional(),
      })
      .partial()
      .optional(),
  })
  .refine((value) => Boolean(value.title || value.body), {
    message: 'Provide a review title or body.',
    path: ['title'],
  });

function normalizeRating(raw: any) {
  const average = Number.isFinite(Number(raw?.average)) ? Number(raw.average) : 0;
  const count = Number.isFinite(Number(raw?.count)) ? Number(raw.count) : 0;
  return { average, count };
}

router.get('/products/:id/reviews/summary', async (req, res) => {
  const productId = String(req.params.id);
  const product = await Product.findById(productId).select({ rating: 1 }).lean();
  if (!product) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  const rating = normalizeRating(product.rating);
  res.json({ ...rating, breakdown: [], lastReviewedAt: null });
});

router.get('/products/:id/reviews', async (req, res) => {
  const productId = String(req.params.id);
  const product = await Product.findById(productId).select({ _id: 1 }).lean();
  if (!product) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  res.json({ items: [], hasMore: false, message: 'Reviews are coming soon.' });
});

router.post('/products/:id/reviews', async (req, res) => {
  const productId = String(req.params.id);
  const product = await Product.findById(productId).select({ _id: 1, rating: 1 }).lean();
  if (!product) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  const parse = submissionSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  }

  const rating = normalizeRating(product.rating);

  res.status(202).json({
    status: 'QUEUED',
    message: 'Reviews are not yet enabled. Your submission has been acknowledged.',
    review: {
      productId,
      rating: parse.data.rating,
      title: parse.data.title,
      body: parse.data.body,
      author: parse.data.author,
    },
    summary: rating,
  });
});

export default router;
