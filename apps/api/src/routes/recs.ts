import { Router } from 'express';
import { z } from 'zod';
import { fetchRecommendationsWithProducts } from '../services/recs';

const router = Router();

router.get('/recommendations', async (req, res) => {
  const schema = z.object({ userId: z.string().optional(), productId: z.string().optional(), k: z.coerce.number().min(1).max(20).optional() });
  const parse = schema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  const { userId, productId, k = 8 } = parse.data;
  try {
    const items = await fetchRecommendationsWithProducts({ userId, productId, k });
    res.json({ items });
  } catch (err) {
    console.error('Recommendations failed', err);
    res.status(502).json({ error: 'RECOMMENDER_UNAVAILABLE' });
  }
});

export default router;
