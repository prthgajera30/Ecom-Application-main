import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface ReviewFormData {
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorEmail: string;
}

interface ReviewFormProps {
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onCancel?: () => void;
  isAuthenticated?: boolean;
  loading?: boolean;
}

export function ReviewForm({ onSubmit, onCancel, isAuthenticated, loading }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [formData, setFormData] = useState<ReviewFormData>({
    rating: 0,
    title: '',
    body: '',
    authorName: '',
    authorEmail: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleRatingClick = (newRating: number) => {
    setRating(newRating);
    setFormData(prev => ({ ...prev, rating: newRating }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.rating;
      return newErrors;
    });
  };

  const handleInputChange = (field: keyof ReviewFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (rating === 0) {
      newErrors['rating'] = 'Please select a rating';
    }

    if (!formData.title.trim() && !formData.body.trim()) {
      newErrors['title'] = 'Please provide a title or review';
    }

    if (!isAuthenticated) {
      if (!formData.authorName.trim()) {
        newErrors['authorName'] = 'Name is required';
      }
      if (!formData.authorEmail.trim()) {
        newErrors['authorEmail'] = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.authorEmail)) {
        newErrors['authorEmail'] = 'Please enter a valid email';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitError(null);
      await onSubmit({
        ...formData,
        rating,
        title: formData.title.trim(),
        body: formData.body.trim(),
        authorName: formData.authorName.trim(),
        authorEmail: formData.authorEmail.trim()
      });
    } catch (error: any) {
      console.error('Review submission error:', error);
      setSubmitError(
        error?.data?.message ||
        error?.message ||
        'Failed to submit review. Please try again.'
      );
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, i) => {
      const starRating = i + 1;
      const isActive = starRating <= (hoverRating || rating);

      return (
        <button
          key={i}
          type="button"
          onClick={() => handleRatingClick(starRating)}
          onMouseEnter={() => setHoverRating(starRating)}
          onMouseLeave={() => setHoverRating(0)}
          className="focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:ring-offset-2 rounded"
        >
          <span
            className={`text-3xl ${
              isActive ? 'text-[color:var(--accent)]' : 'text-subtle hover:text-[color:var(--accent)]'
            }`}
          >
            ★
          </span>
        </button>
      );
    });
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-muted">Write a Review</h3>
          <p className="text-sm text-muted mt-1">
            Share your experience with this product
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div>
        <label className="block text-sm font-medium text-muted mb-3">
              Rating *
            </label>
            <div className="flex items-center space-x-2">
              {renderStars()}
              {rating > 0 && (
                <span className="text-sm text-muted ml-2">
                  {rating} star{rating !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {errors.rating && (
              <p className="text-sm text-[var(--danger-100)] mt-1">{errors.rating}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-muted mb-2">
              Review Title
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              maxLength={120}
              placeholder="Sum up your experience"
              className="w-full px-3 py-2 bg-[var(--surface-solid)] text-[var(--text-primary)] border border-[var(--surface-border)] rounded-md focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            />
            <div className="flex justify-between mt-1">
              {errors.title && (
                <p className="text-sm text-[var(--danger-100)]">{errors.title}</p>
              )}
              <span className="text-xs text-muted ml-auto">
                {formData.title.length}/120
              </span>
            </div>
          </div>

          {/* Body */}
          <div>
              <label htmlFor="body" className="block text-sm font-medium text-muted mb-2">
              Review Details
            </label>
            <textarea
              id="body"
              value={formData.body}
              onChange={(e) => handleInputChange('body', e.target.value)}
              maxLength={2000}
              rows={6}
              placeholder="Tell others about your experience with this product"
              className="w-full px-3 py-2 bg-[var(--surface-solid)] text-[var(--text-primary)] border border-[var(--surface-border)] rounded-md focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            />
            <div className="flex justify-between mt-1">
              {errors.body && (
                <p className="text-sm text-[var(--danger-100)]">{errors.body}</p>
              )}
              <span className="text-xs text-muted ml-auto">
                {formData.body.length}/2000
              </span>
            </div>
          </div>

          {/* Guest fields (only shown if not authenticated) */}
          {!isAuthenticated && (
            <div className="space-y-4 p-4 bg-[var(--surface-muted)] rounded-lg">
              <div className="flex items-center space-x-2 text-sm text-muted">
                <span className="text-sm">👤</span>
                <span>Your information is kept private</span>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="authorName" className="block text-sm font-medium text-muted mb-2">
                    Name *
                  </label>
                  <input
                    id="authorName"
                    type="text"
                    value={formData.authorName}
                    onChange={(e) => handleInputChange('authorName', e.target.value)}
                    maxLength={80}
                    className="w-full px-3 py-2 bg-[var(--surface-solid)] text-[var(--text-primary)] border border-[var(--surface-border)] rounded-md focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                  />
                  {errors.authorName && (
                    <p className="text-sm text-[var(--danger-100)] mt-1">{errors.authorName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="authorEmail" className="block text-sm font-medium text-muted mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <input
                      id="authorEmail"
                      type="email"
                      value={formData.authorEmail}
                      onChange={(e) => handleInputChange('authorEmail', e.target.value)}
                      maxLength={100}
                      className="w-full pl-9 pr-3 py-2 bg-[var(--surface-solid)] text-[var(--text-primary)] border border-[var(--surface-border)] rounded-md focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                      placeholder="your.email@example.com"
                    />
                    <span className="absolute left-3 top-2.5 text-sm text-muted">@</span>
                  </div>
                  {errors.authorEmail && (
                    <p className="text-sm text-[var(--danger-100)] mt-1">{errors.authorEmail}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-[var(--surface-border)]">
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Review'}
            </Button>

            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="rounded-lg bg-[var(--danger-10)] border border-[var(--danger)]/20 p-4 mt-4">
              <div className="flex items-center">
                <span className="text-[var(--danger-100)] text-lg mr-2">⚠️</span>
                <p className="text-sm text-[var(--danger-100)]">{submitError}</p>
              </div>
            </div>
          )}
        </form>
      </div>
    </Card>
  );
}
