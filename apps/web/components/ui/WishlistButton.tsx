'use client';

import { useState } from 'react';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, ButtonLink } from './Button';
import { cn } from '../../lib/cn';

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'button';
  children?: React.ReactNode;
}

export function WishlistButton({
  productId,
  className,
  size = 'md',
  variant = 'icon',
  children
}: WishlistButtonProps) {
  const { isInWishlist, addToWishlist, removeFromWishlist, isLoading } = useWishlist();
  const { user } = useAuth();
  const { push: showToast } = useToast();
  const [localLoading, setLocalLoading] = useState(false);

  const isAuthenticated = !!user;
  const inWishlist = isInWishlist(productId);
  const loading = isLoading || localLoading;

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      showToast({
        title: 'Sign in required',
        description: 'Please sign in to save items to your wishlist.',
        variant: 'error'
      });
      return;
    }

    setLocalLoading(true);
    try {
      if (inWishlist) {
        await removeFromWishlist(productId);
        showToast({
          title: 'Removed from wishlist',
          description: 'Product removed from your wishlist.',
          variant: 'success'
        });
      } else {
        await addToWishlist(productId);
        showToast({
          title: 'Added to wishlist',
          description: 'Product saved to your wishlist.',
          variant: 'success'
        });
      }
    } catch (error) {
      showToast({
        title: 'Error',
        description: 'Unable to update wishlist. Please try again.',
        variant: 'error'
      });
    } finally {
      setLocalLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        onClick={handleToggleWishlist}
        disabled={loading}
        size="icon"
        variant="ghost"
        className={cn(
          'shrink-0 transition-colors',
      inWishlist
        ? 'text-[var(--danger-100)] hover:text-[var(--danger-100)]/90'
        : 'text-[var(--text-muted)] hover:text-[var(--danger-100)]',
          className
        )}
        title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {loading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <span className={cn(
            'text-lg transition-all',
            inWishlist && 'scale-110'
          )}>
            {inWishlist ? '❤️' : '🤍'}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleToggleWishlist}
      disabled={loading}
      size={size}
      variant="ghost"
      className={cn(
        'gap-2 transition-colors',
        inWishlist
          ? 'text-[var(--danger-100)] hover:text-[var(--danger-100)]/90'
          : 'text-[var(--text-muted)] hover:text-[var(--danger-100)]',
        className
      )}
    >
      {loading ? (
        <span className="animate-spin">⏳</span>
      ) : (
        <span className={cn(
          'text-lg transition-all',
          inWishlist && 'scale-110'
        )}>
          {inWishlist ? '❤️' : '🤍'}
        </span>
      )}
      {children || (inWishlist ? 'Saved' : 'Save')}
    </Button>
  );
}
