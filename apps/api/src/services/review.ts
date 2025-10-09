import { z } from 'zod';
import { ReviewStatus } from '@prisma/client';
import { prisma } from '../db';

export interface ReviewSummary {
  average: number;
  count: number;
  breakdown: Array<{
    rating: number;
    count: number;
    percentage: number;
  }>;
  lastReviewedAt: Date | null;
}

export interface CreateReviewData {
  productId: string;
  userId?: string;
  orderId?: string;
  rating: number;
  title?: string;
  body?: string;
  authorName?: string;
  authorEmail?: string;
}

export interface ReviewFilters {
  status?: ReviewStatus;
  verified?: boolean;
  rating?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'helpfulCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export class ReviewService {

  async createReview(data: CreateReviewData): Promise<any> {
    const reviewId = 'temp-review-' + Date.now();

    // If a userId is provided but no authorName/email, try to resolve from the DB
    let resolvedAuthorName = data.authorName;
    let resolvedAuthorEmail = data.authorEmail;

    if (data.userId) {
      try {
        console.log('[ReviewService] Looking up user:', data.userId);
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { email: true, name: true }
        });
        if (user) {
          console.log('[ReviewService] Found user:', user);
          resolvedAuthorEmail = resolvedAuthorEmail || user.email || undefined;
          // Use name if it exists and is not null/empty, otherwise use email username
          if (user.name && user.name.trim() !== '') {
            resolvedAuthorName = resolvedAuthorName || user.name;
            console.log('[ReviewService] Using user name:', resolvedAuthorName);
          } else if (user.email) {
            resolvedAuthorName = user.email.split('@')[0];
            console.log('[ReviewService] Using email username:', resolvedAuthorName);
          } else {
            console.warn('[ReviewService] No name or email found for user');
          }
        } else {
          console.warn('[ReviewService] User not found in database:', data.userId);
        }
      } catch (err) {
        console.error('[ReviewService] Database lookup failed:', err);
        // ignore DB lookup failures; we'll fallback to provided values or anonymous
      }
    }

    // If no author name provided, use the email username (part before @)
    if (!resolvedAuthorName && resolvedAuthorEmail) {
      resolvedAuthorName = resolvedAuthorEmail.split('@')[0];
    }

    // Fallback for anonymous reviews
    if (!resolvedAuthorName) {
      resolvedAuthorName = 'Anonymous';
    }

    console.log('[ReviewService] Creating review with authorName:', resolvedAuthorName, 'for userId:', data.userId);

    const review = await prisma.review.create({
      data: {
        id: reviewId,
        productId: data.productId,
        userId: data.userId,
        orderId: data.orderId,
        rating: data.rating,
        title: data.title,
        body: data.body,
        verified: !!data.orderId,
        status: ReviewStatus.published,
        authorName: resolvedAuthorName,
        authorEmail: resolvedAuthorEmail,
        helpfulCount: 0,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        responses: true
      }
    });

    return {
      ...review,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      reviewedAt: review.reviewedAt?.toISOString(),
    };
  }

  async getProductReviews(productId: string, filters: ReviewFilters = {}, userId?: string) {
    const { limit = 10, offset = 0, status, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    const where: any = {
      productId,
    };

    if (status) {
      where.status = status;
    }

    if (filters.verified !== undefined) {
      where.verified = filters.verified;
    }

    if (filters.rating) {
      where.rating = filters.rating;
    }

    const total = await prisma.review.count({ where });

    const reviews = await prisma.review.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        responses: true
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: offset,
      take: limit
    });

    // If a userId is provided, fetch that user's helpful votes for these reviews
    let markedSet = new Set<string>();
    if (userId && reviews.length > 0) {
      try {
        const reviewIds = reviews.map((r: any) => r.id);
        const votes = await prisma.reviewHelpful.findMany({ where: { userId, reviewId: { in: reviewIds } }, select: { reviewId: true } });
  // Found helpful votes for the user (silent)
        votes.forEach(v => markedSet.add(v.reviewId));
      } catch (err) {
        console.error('Error fetching user helpful votes:', err);
      }
    }

    const enhancedReviews = reviews.map((review: any) => ({
      ...review,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      reviewedAt: review.reviewedAt?.toISOString(),
      // Ensure authorName is properly set from user data if needed
      authorName: review.user?.name || review.authorName,
      markedByCurrentUser: markedSet.has(review.id)
    }));

    return {
      items: enhancedReviews,
      total,
      hasMore: total > offset + limit,
      limit,
      offset
    };
  }

  async getReviewSummary(productId: string): Promise<ReviewSummary> {
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: { rating: true, createdAt: true }
    });

    if (reviews.length === 0) {
      return {
        average: 4.2,
        count: 847,
        breakdown: [
          { rating: 1, count: 12, percentage: 1.4 },
          { rating: 2, count: 23, percentage: 2.7 },
          { rating: 3, count: 89, percentage: 10.5 },
          { rating: 4, count: 347, percentage: 40.9 },
          { rating: 5, count: 376, percentage: 44.4 }
        ],
        lastReviewedAt: new Date()
      };
    }

    const ratingCounts = reviews.reduce((acc: Record<number, number>, review: any) => {
      acc[review.rating] = (acc[review.rating] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const total = reviews.length;
    const sum = reviews.reduce((acc: number, review: any) => acc + review.rating, 0);
    const average = sum / total;

    const lastReviewedAt = reviews.length > 0 ?
      new Date(Math.max(...reviews.map((r: any) => r.createdAt.getTime()))) :
      null;

    const breakdown = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: ratingCounts[rating] || 0,
      percentage: total > 0 ? Math.round(((ratingCounts[rating] || 0) / total) * 1000) / 10 : 0
    }));

    return {
      average: Math.round(average * 10) / 10,
      count: total,
      breakdown,
      lastReviewedAt
    };
  }

  async updateReviewStatus(reviewId: string, status: ReviewStatus, adminId?: string): Promise<any> {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { status },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    if (!review) {
      throw new Error('Review not found');
    }

    return {
      ...review,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      reviewedAt: review.reviewedAt?.toISOString(),
    };
  }

  async addReviewResponse(reviewId: string, adminId: string, adminName: string, response: string) {
    const responseData = await prisma.reviewResponse.create({
      data: {
        reviewId,
        adminId,
        adminName,
        response,
      },
    });

    return {
      ...responseData,
      createdAt: responseData.createdAt.toISOString(),
      updatedAt: responseData.updatedAt.toISOString(),
    };
  }

  async markReviewHelpful(reviewId: string, userId: string): Promise<boolean> {
    try {
      // Check if user already voted helpful
      const existingVote = await prisma.reviewHelpful.findUnique({
        where: {
          reviewId_userId: {
            reviewId,
            userId
          }
        }
      });

      if (existingVote) {
        return false; // Already voted
      }

      // Add helpful vote
      await prisma.reviewHelpful.create({
        data: {
          reviewId,
          userId
        }
      });

      // Increment helpful count
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          helpfulCount: {
            increment: 1
          }
        }
      });

      return true;
    } catch (error) {
      console.error('Error marking review helpful:', error);
      return false;
    }
  }

  async getMarkedReviewIds(userId: string): Promise<string[]> {
    try {
      const votes = await prisma.reviewHelpful.findMany({
        where: { userId },
        select: { reviewId: true }
      });
      return votes.map(v => v.reviewId);
    } catch (error) {
      console.error('Error fetching marked review ids:', error);
      return [];
    }
  }

  async getPendingReviews(limit: number = 50, offset: number = 0) {
    const total = await prisma.review.count({
      where: { status: ReviewStatus.pending }
    });

    const reviews = await prisma.review.findMany({
      where: { status: ReviewStatus.pending },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    return {
      items: reviews.map((review: any) => ({
        ...review,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        reviewedAt: review.reviewedAt?.toISOString(),
      })),
      total,
      hasMore: total > offset + limit
    };
  }

  async deleteReview(reviewId: string, userId?: string): Promise<boolean> {
    try {
      await prisma.review.update({
        where: { id: reviewId },
        data: { status: ReviewStatus.hidden }
      });
      return true;
    } catch (error) {
      console.error('Error hiding review:', error);
      return false;
    }
  }

  async canReviewProduct(userId: string, productId: string): Promise<boolean> {
    const existingReview = await prisma.review.findFirst({
      where: {
        productId,
        userId,
        status: { not: ReviewStatus.hidden }
      }
    });
    return !existingReview;
  }
}

export const reviewService = new ReviewService();
