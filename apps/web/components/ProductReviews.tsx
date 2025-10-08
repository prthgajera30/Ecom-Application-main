import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ReviewCard, Review } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { useAuth } from '../context/AuthContext';

interface ReviewSummary {
  average: number;
  count: number;
  breakdown: Array<{
    rating: number;
    count: number;
    percentage: number;
  }>;
  lastReviewedAt: Date | null;
}

interface ReviewFilters {
  status?: 'published';
  verified?: boolean;
  rating?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'helpfulCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

interface ProductReviewsProps {
  productId: string;
  api: {
    getReviewSummary: (productId: string) => Promise<ReviewSummary>;
    getProductReviews: (productId: string, filters: ReviewFilters) => Promise<{
      items: Review[];
      total: number;
      hasMore: boolean;
      limit: number;
      offset: number;
    }>;
    createReview: (productId: string, data: any) => Promise<Review>;
    markReviewHelpful: (reviewId: string) => Promise<void>;
    addReviewResponse: (reviewId: string, response: string) => Promise<any>;
  };
  onUpdateSummary?: (summary: ReviewSummary) => void;
}

export function ProductReviews({ productId, api, onUpdateSummary }: ProductReviewsProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalReviews, setTotalReviews] = useState(0);
  const [filters, setFilters] = useState<ReviewFilters>({
    status: 'published',
    limit: 10,
    offset: 0,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const reviewFormRef = useRef<HTMLDivElement>(null);

  // Load summary and initial reviews
  useEffect(() => {
    loadSummary();
    loadReviews(true);
  }, [productId]);

  // Auto-scroll to review form when it opens
  useEffect(() => {
    if (showReviewForm && reviewFormRef.current) {
      reviewFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showReviewForm]);

  const loadSummary = async () => {
    try {
      const summaryData = await api.getReviewSummary(productId);
      setSummary(summaryData);
      onUpdateSummary?.(summaryData);
    } catch (error) {
      console.error('Error loading review summary:', error);
    }
  };

  const loadReviews = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setFilters(prev => ({ ...prev, offset: 0 }));
      } else {
        setLoadingMore(true);
      }

      const currentFilters = reset
        ? { ...filters, offset: 0 }
        : filters;

      const result = await api.getProductReviews(productId, currentFilters);

      if (reset) {
        setReviews(result.items);
      } else {
        setReviews(prev => [...prev, ...result.items]);
      }

      setHasMore(result.hasMore);
      setTotalReviews(result.total);
      setFilters(currentFilters);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmitReview = async (reviewData: any) => {
    try {
      const newReview = await api.createReview(productId, reviewData);
      setReviews(prev => [newReview, ...prev]);
      setTotalReviews(prev => prev + 1);
      setShowReviewForm(false);

      // Refresh summary
      await loadSummary();
    } catch (error) {
      throw error; // Let the form handle the error
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    try {
      await api.markReviewHelpful(reviewId);

      // Update the review in the list
      setReviews(prev => prev.map(review =>
        review.id === reviewId
          ? { ...review, helpfulCount: review.helpfulCount + 1 }
          : review
      ));
    } catch (error) {
      console.error('Error marking review helpful:', error);
    }
  };

  const handleAddResponse = async (reviewId: string, response: string) => {
    if (!isAdmin) return;

    try {
      await api.addReviewResponse(reviewId, response);

      // Reload reviews to show the new response
      await loadReviews(true);
    } catch (error) {
      console.error('Error adding review response:', error);
      throw error;
    }
  };

  const loadMoreReviews = () => {
    if (!hasMore || loadingMore) return;

    setFilters(prev => ({ ...prev, offset: (prev.offset ?? 0) + (prev.limit ?? 0) }));
  };

  const changeSorting = (sortBy: 'createdAt' | 'helpfulCount' | 'rating') => {
    const newSortOrder = filters.sortBy === sortBy && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    setFilters(prev => ({ ...prev, sortBy, sortOrder: newSortOrder, offset: 0 }));
    loadReviews(true);
  };

  const renderRatingSummary = () => {
    if (!summary) return null;

    const renderStars = (rating: number) => {
      return Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`inline-block text-lg ${
              i < rating ? 'text-[color:var(--accent)]' : 'text-subtle'
            }`}
          >
            ★
          </span>
      ));
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overall Rating */}
        <div className="text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start mb-2">
            <span className="text-3xl font-bold text-muted mr-2">
              {summary.average.toFixed(1)}
            </span>
            <div className="flex">
              {renderStars(Math.round(summary.average))}
            </div>
          </div>
          <p className="text-muted">
            Based on {summary.count} review{summary.count !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Rating Breakdown */}
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map(rating => {
            const breakdown = summary.breakdown.find(b => b.rating === rating);
            const percentage = breakdown?.percentage || 0;

            return (
              <div key={rating} className="flex items-center text-sm">
                  <span className="w-3 text-subtle">{rating}</span>
                <span className="inline-block text-[color:var(--accent)] ml-1 mr-2">★</span>
                    <div className="flex-1 bg-ghost-10 rounded-full h-2 mx-2">
                      <div
                        className="bg-[color:var(--accent)] h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  <span className="w-10 text-right text-subtle">
                  {breakdown?.count || 0}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFilters = () => {
    const sortOptions = [
      { label: 'Most Recent', value: 'createdAt' },
      { label: 'Most Helpful', value: 'helpfulCount' },
      { label: 'Highest Rated', value: 'rating' }
    ];

    return (
      <div className="flex items-center justify-between py-4 border-b border-[var(--surface-border)]">
        <div className="flex items-center space-x-4">
            <span className="font-medium text-muted">
            {totalReviews} Review{totalReviews !== 1 ? 's' : ''}
          </span>

          <div className="flex items-center space-x-2">
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                changeSorting(sortBy as any);
              }}
              className="text-sm border-[var(--surface-border)] rounded-md focus:ring-[var(--brand)] focus:border-[var(--brand)] bg-[color:var(--surface-solid)] text-[var(--text-primary)]"
            >
              {sortOptions.map(option => (
                <option key={`${option.value}-desc`} value={`${option.value}-desc`}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {user && (
          <Button
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="flex items-center space-x-2"
          >
            <span className="text-muted text-sm">💬</span>
            <span>Write Review</span>
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-muted">
      {/* Rating Summary */}
      {summary && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Customer Reviews</h3>
          {renderRatingSummary()}
        </Card>
      )}

      {/* Review Form */}
      {showReviewForm && user && (
        <div ref={reviewFormRef}>
          <ReviewForm
            onSubmit={handleSubmitReview}
            onCancel={() => setShowReviewForm(false)}
            isAuthenticated={!!user}
            loading={false}
          />
        </div>
      )}

      {/* Filters and Actions */}
      {renderFilters()}

      {/* Reviews List */}
      <div className="space-y-4 text-muted">
        {loading ? (
          <div className="text-center py-8 text-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--brand)] mx-auto text-muted"></div>
            <p className="mt-2">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <Card className="p-8 text-center text-muted">
        <span className="text-4xl mx-auto mb-4 block text-muted">💬</span>
            <h3 className="text-lg font-medium mb-2 text-muted">No reviews yet</h3>
            <p className="mb-4">
              Be the first to share your thoughts about this product.
            </p>
            {user && (
              <Button onClick={() => setShowReviewForm(true)}>
                Write the First Review
              </Button>
            )}
          </Card>
        ) : (
          <>
            {reviews.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                onMarkHelpful={handleMarkHelpful}
                onRespond={isAdmin ? handleAddResponse : undefined}
                currentUserId={user?.id}
                isAdmin={isAdmin}
              />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center py-4">
                <Button
                  onClick={loadMoreReviews}
                  disabled={loadingMore}
                  variant="secondary"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[color:var(--brand)] mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More Reviews
                      <span className="inline-block ml-2">⯆</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
