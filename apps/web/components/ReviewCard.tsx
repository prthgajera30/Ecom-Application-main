import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export interface Review {
  id: string;
  productId: string;
  userId?: string;
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
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  responses: Array<{
    id: string;
    adminName: string;
    response: string;
    createdAt: string;
  }>;
}

interface ReviewCardProps {
  review: Review;
  onMarkHelpful?: (reviewId: string) => void;
  onRespond?: (reviewId: string, response: string) => void;
  currentUserId?: string;
  isAdmin?: boolean;
  showResponses?: boolean;
}

export function ReviewCard({
  review,
  onMarkHelpful,
  onRespond,
  currentUserId,
  isAdmin,
  showResponses = true
}: ReviewCardProps) {
  const [isResponding, setIsResponding] = useState(false);
  const [responseText, setResponseText] = useState('');

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`inline-block text-lg ${
          i < rating ? 'text-yellow-400' : 'text-gray-300'
        }`}
      >
        ★
      </span>
    ));
  };

  const handleRespond = async () => {
    if (!responseText.trim() || !onRespond) return;

    try {
      await onRespond(review.id, responseText);
      setResponseText('');
      setIsResponding(false);
    } catch (error) {
      // Error handled by parent
    }
  };

  // Display preference: prioritize email username, then user name, then explicit guest name, then fallback
  const authorName = (() => {
    // First priority: email username (part before @) - this is what the user wants
    const userEmail = review.user?.email || review.authorEmail;
    if (userEmail && String(userEmail).includes('@')) {
      return String(userEmail).split('@')[0];
    }

    // Second priority: use the user's actual name if available
    if (review.user?.name && String(review.user.name).trim()) return review.user.name;

    // Third priority: explicit guest authorName
    if (review.authorName && String(review.authorName).trim()) return review.authorName;

    // Fourth priority: short user id (fallback for registered users without name/email)
    const uid = review.user?.id;
    if (uid) return `User ${String(uid).slice(0, 8)}`;

    // Final fallback
    return 'Anonymous';
  })();
  const isVerified = review.verified;
  const timeAgo = new Date(review.createdAt).toLocaleDateString();

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">👤</span>
              <span className="font-medium text-gray-400">{authorName}</span>
              {isVerified && (
                <div className="flex items-center space-x-1 text-green-600">
                  <span className="text-sm text-green-600">✓</span>
                  <span className="text-sm">Verified Purchase</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              {renderStars(review.rating)}
              <span className="text-sm font-medium text-gray-400 ml-2">
                {review.rating}
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        {review.title && (
          <h4 className="text-lg font-semibold text-gray-400">{review.title}</h4>
        )}

        {/* Body */}
        {review.body && (
          <p className="text-gray-500 leading-relaxed">{review.body}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">{timeAgo}</span>

            {onMarkHelpful && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkHelpful(review.id)}
                className="flex items-center space-x-1 text-gray-600 hover:text-blue-600"
              >
                <span className="text-gray-600 text-sm">👍</span>
                <span className="text-sm">
                  Helpful ({review.helpfulCount})
                </span>
              </Button>
            )}

            {isAdmin && onRespond && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsResponding(!isResponding)}
                className="flex items-center space-x-1 text-gray-600 hover:text-blue-600"
              >
                <span className="text-gray-600 text-sm">💬</span>
                <span className="text-sm">Respond</span>
              </Button>
            )}
          </div>

          <div className="text-xs text-gray-400 uppercase font-medium">
            {review.status}
          </div>
        </div>

        {/* Response Form */}
        {isResponding && isAdmin && onRespond && (
          <div className="mt-4 space-y-3">
            <textarea
              placeholder="Write your response to this review..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
            <div className="flex space-x-2">
              <Button onClick={handleRespond} disabled={!responseText.trim()}>
                Post Response
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsResponding(false);
                  setResponseText('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Responses */}
        {showResponses && review.responses.length > 0 && (
          <div className="mt-6 space-y-3">
            <h5 className="text-sm font-medium text-gray-400">Seller Response</h5>
            {review.responses.map((response) => (
              <div
                key={response.id}
                className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-medium text-blue-900">{response.adminName}</span>
                  <span className="text-sm text-blue-600">Seller</span>
                </div>
                <p className="text-blue-800">{response.response}</p>
                <p className="text-xs text-blue-600 mt-2">
                  {new Date(response.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
