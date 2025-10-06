"use client";
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, XCircle, AlertTriangle, Eye, MessageSquare, ThumbsUp, Star, User } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ReviewCard } from '../../../components/ReviewCard';
import { useAuth } from '../../../context/AuthContext';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';

interface Review {
  id: string;
  productId: string;
  userId?: string;
  user?: { id: string; email: string };
  orderId?: string;
  order?: { id: string; status: string };
  rating: number;
  title?: string;
  body?: string;
  verified: boolean;
  helpfulCount: number;
  status: string;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
  reviewedAt?: string;
  responses: Array<{
    id: string;
    adminName: string;
    response: string;
    createdAt: string;
  }>;
}

interface PendingReview extends Review {
  order?: { id: string; status: string };
}

export default function AdminReviewsPage() {
  const { user } = useAuth();
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'recent'>('pending');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    loadReviews();
  }, [activeTab]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
  const result = await apiGet<any>('/reviews/admin/pending');
  setPendingReviews(result.items || []);
      } else {
        // For recent reviews, we could add a separate endpoint or filter
        // For now, we'll show reviews from the last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        // This would need a proper endpoint
        setRecentReviews([]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (reviewId: string, action: 'publish' | 'reject' | 'hide') => {
    if (!user) return;

    setActionLoading(reviewId);

    try {
      let status = 'pending';
      if (action === 'publish') status = 'published';
      else if (action === 'reject') status = 'rejected';
      else if (action === 'hide') status = 'hidden';

      await apiPatch(`/reviews/${reviewId}/status`, { status });

      // Update local state
      setPendingReviews(prev => prev.filter(review => review.id !== reviewId));

      // Show success message or notification
    } catch (error) {
      console.error('Error updating review status:', error);
      // Show error message
    } finally {
      setActionLoading(null);
    }
  };

  const handleRespond = async (reviewId: string) => {
    if (!user || !responseText.trim()) return;

    try {
      await apiPost(`/reviews/${reviewId}/responses`, {
        response: responseText.trim()
      });

      setResponseText('');
      setSelectedReview(null);

      // Refresh data
      loadReviews();
    } catch (error) {
      console.error('Error adding response:', error);
      // Show error message
    }
  };

  const renderPendingReviews = () => {
    if (pendingReviews.length === 0) {
      return (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-600">No reviews are waiting for moderation.</p>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {pendingReviews.map(review => (
          <Card key={review.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">
                    {review.authorName || review.user?.email || 'Anonymous'}
                  </span>
                  {review.verified && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      Verified Purchase
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
              </span>
            </div>

            {review.title && (
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{review.title}</h4>
            )}

            {review.body && (
              <p className="text-gray-700 mb-4">{review.body}</p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {review.order && (
                  <span>Order #{review.order.id}</span>
                )}
                <span>Product ID: {review.productId}</span>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviewAction(review.id, 'publish')}
                  disabled={actionLoading === review.id}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviewAction(review.id, 'reject')}
                  disabled={actionLoading === review.id}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReview(review)}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Respond
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderResponseModal = () => {
    if (!selectedReview) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl mx-4 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Respond to Review by {selectedReview.authorName || selectedReview.user?.email || 'Anonymous'}
          </h3>

          <div className="mb-4">
            <ReviewCard
              review={selectedReview}
              currentUserId={user?.id}
              isAdmin={true}
              showResponses={true}
            />
          </div>

          <div className="space-y-4">
            <textarea
              placeholder="Write your response to this review..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />

            <div className="flex space-x-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedReview(null);
                  setResponseText('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleRespond(selectedReview.id)}
                disabled={!responseText.trim()}
              >
                Post Response
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Management</h1>
          <p className="text-gray-600 mt-1">Moderate and respond to customer reviews</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={loadReviews}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Reviews ({pendingReviews.length})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'recent'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Recent Reviews ({recentReviews.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading reviews...</p>
          </div>
        ) : activeTab === 'pending' ? (
          renderPendingReviews()
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">Recent reviews view coming soon...</p>
          </div>
        )}
      </div>

      {/* Response Modal */}
      {renderResponseModal()}
    </div>
  );
}
