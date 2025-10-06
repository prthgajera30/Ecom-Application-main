import { Router } from 'express';
import { z } from 'zod';
import { Product, prisma } from '../db';
import mongoose from 'mongoose';
import { reviewService, ReviewFilters as ServiceReviewFilters } from '../services/review';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import jwt from 'jsonwebtoken';

export enum ReviewStatus {
  draft = 'draft',
  pending = 'pending',
  published = 'published',
  rejected = 'rejected',
  hidden = 'hidden'
}

const router = Router();

const createReviewSchema = z
  .object({
    rating: z.number().min(1).max(5),
    title: z.string().max(120).optional(),
    body: z.string().max(2000).optional(),
    authorName: z.preprocess((v) => {
      if (typeof v === 'string' && v.trim() === '') return undefined;
      return v;
    }, z.string().max(80).optional()),
    authorEmail: z.preprocess((v) => {
      if (typeof v === 'string' && v.trim() === '') return undefined;
      return v;
    }, z.string().email().optional()),
  })
  .refine((value) => Boolean(value.title || value.body), {
    message: 'Provide a review title or body.',
    path: ['title'],
  });

const reviewFiltersSchema = z.object({
  status: z.preprocess((v) => typeof v === 'string' ? v : undefined,
    z.enum(['draft', 'pending', 'published', 'rejected', 'hidden']).optional()),
  verified: z.preprocess((v) => {
    if (typeof v === 'string') return v === 'true';
    if (typeof v === 'boolean') return v;
    return undefined;
  }, z.boolean().optional()),
  rating: z.preprocess((v) => {
    if (typeof v === 'string') return parseInt(v, 10);
    if (typeof v === 'number') return v;
    return undefined;
  }, z.number().min(1).max(5).optional()),
  limit: z.preprocess((v) => {
    if (typeof v === 'string') return parseInt(v, 10);
    if (typeof v === 'number') return v;
    return undefined;
  }, z.number().min(1).max(100).optional()),
  offset: z.preprocess((v) => {
    if (typeof v === 'string') return parseInt(v, 10);
    if (typeof v === 'number') return v;
    return undefined;
  }, z.number().min(0).optional()),
  sortBy: z.preprocess((v) => typeof v === 'string' ? v : undefined,
    z.enum(['createdAt', 'helpfulCount', 'rating']).optional()),
  sortOrder: z.preprocess((v) => typeof v === 'string' ? v : undefined,
    z.enum(['asc', 'desc']).optional()),
});

// Get review summary for a product
router.get('/products/:id/reviews/summary', async (req, res) => {
  try {
    const productId = String(req.params.id);

    // Verify product exists (still check MongoDB for now)
    const product = await Product.findById(productId).select({ _id: 1 }).lean();
    if (!product) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const summary = await reviewService.getReviewSummary(productId);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching review summary:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Get reviews for a product
router.get('/products/:id/reviews', async (req, res) => {
  try {
    const productId = String(req.params.id);

    // Verify product exists - ensure productId is a valid ObjectId first
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.info('[reviews] invalid productId format, returning 404', { productId });
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const product = await Product.findById(productId).select({ _id: 1 }).lean();
    if (!product) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const parseFilters = reviewFiltersSchema.safeParse(req.query);
    if (!parseFilters.success) {
      return res.status(400).json({ error: 'VALIDATION', details: parseFilters.error.flatten() });
    }

    // Cast status to ReviewStatus if present
    const filters = { ...parseFilters.data };
    if (filters.status) {
      const statusStr = filters.status as string;
      switch (statusStr) {
        case 'draft':
          filters.status = ReviewStatus.draft;
          break;
        case 'pending':
          filters.status = ReviewStatus.pending;
          break;
        case 'published':
          filters.status = ReviewStatus.published;
          break;
        case 'rejected':
          filters.status = ReviewStatus.rejected;
          break;
        case 'hidden':
          filters.status = ReviewStatus.hidden;
          break;
        default:
          filters.status = undefined;
      }
    }
  const reviews = await reviewService.getProductReviews(productId, filters as ServiceReviewFilters);
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create a new review
router.post('/products/:id/reviews', async (req, res) => {
  try {
    const productId = String(req.params.id);
  // May be undefined for anonymous reviews; if an Authorization header is present
  // decode it (but do not enforce auth) so we can associate the review with the user.
  let userId = (req as any).user?.id;
  try {
    if (!userId && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.slice(7);
      const secret = process.env.JWT_SECRET || 'change_me';
      const decoded = jwt.verify(token, secret) as any;
      userId = decoded?.userId;
    }
  } catch (err) {
    // ignore token errors; proceed as anonymous
    userId = userId;
  }

    // Debug logging: show incoming productId and a trimmed version of the request body
    try {
      const safeBody = { ...req.body };
      if (safeBody.body && typeof safeBody.body === 'string' && safeBody.body.length > 200) {
        safeBody.body = `${safeBody.body.slice(0, 200)}...(+truncated)`;
      }
      // Log a small subset of headers for debugging (don't log everything to avoid sensitive data)
      const headersToLog: any = {
        'content-type': req.headers['content-type'],
        'x-session-id': req.headers['x-session-id'],
        authorization: req.headers['authorization'],
      };
      console.info('[reviews] POST /products/:id/reviews incoming', { productId, userId, headers: headersToLog, body: safeBody });
    } catch (err) {
      console.info('[reviews] POST /products/:id/reviews incoming - could not serialize body', { productId, userId });
    }

    // Verify product exists
    const product = await Product.findById(productId).select({ _id: 1 }).lean();
    if (!product) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const parse = createReviewSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
    }

    // For authenticated users, check if they can review this product
    if (userId) {
      const canReview = await reviewService.canReviewProduct(userId, productId);
      if (!canReview) {
        return res.status(400).json({
          error: 'CANNOT_REVIEW',
          message: 'You must purchase this product before reviewing it, or you have already reviewed it.'
        });
      }
    }

    // Find associated order for verified purchase (if user is authenticated)
    let orderId: string | undefined;
    if (userId) {
      // Find most recent paid order containing this product
      const orderItem = await prisma?.orderItem.findFirst({
        where: {
          productId,
          order: {
            userId,
            status: 'paid'
          }
        },
        orderBy: { order: { createdAt: 'desc' } },
        select: { orderId: true }
      });
      orderId = orderItem?.orderId;
    }

    const review = await reviewService.createReview({
      productId,
      userId,
      orderId,
      ...parse.data
    });

    res.status(201).json(review);
  } catch (error: any) {
    console.error('Error creating review:', error);

    if (error.message === 'User has already reviewed this product') {
      return res.status(409).json({ error: 'DUPLICATE_REVIEW', message: error.message });
    }

    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Mark review as helpful
router.post('/:id/helpful', requireAuth, async (req, res) => {
  try {
    const reviewId = String(req.params.id);
  const userId = (req as any).user!.id;

    const wasMarked = await reviewService.markReviewHelpful(reviewId, userId);

    if (!wasMarked) {
      return res.status(409).json({
        error: 'ALREADY_MARKED',
        message: 'You have already marked this review as helpful'
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking review helpful:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Admin routes for review moderation
router.get('/admin/pending', requireAdmin, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
    const offset = req.query.offset ? parseInt(String(req.query.offset)) : 0;

    const result = await reviewService.getPendingReviews(limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const reviewId = String(req.params.id);
    const { status } = req.body;
  const adminId = (req as any).user!.id;

    if (!['published', 'rejected', 'hidden'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS' });
    }

    const review = await reviewService.updateReviewStatus(reviewId, status, adminId);
    res.json(review);
  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/:id/responses', requireAdmin, async (req, res) => {
  try {
    const reviewId = String(req.params.id);
    const { response } = req.body;
  const adminId = (req as any).user!.id;
  const adminName = (req as any).user!.email; // Using email as display name

    if (!response || typeof response !== 'string' || response.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_RESPONSE' });
    }

    const reviewResponse = await reviewService.addReviewResponse(reviewId, adminId, adminName, response.trim());
    res.status(201).json(reviewResponse);
  } catch (error: any) {
    console.error('Error adding review response:', error);

    if (error.message === 'Unauthorized: Only admins can respond to reviews') {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Delete review (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const reviewId = String(req.params.id);
  const userId = (req as any).user!.id;

    const deleted = await reviewService.deleteReview(reviewId, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting review:', error);

    if (error.message === 'Unauthorized to delete this review') {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
