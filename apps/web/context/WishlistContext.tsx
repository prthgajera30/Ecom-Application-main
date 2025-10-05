'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiGet, apiPost, apiDelete, ApiError } from '../lib/api';

interface WishlistContextType {
  wishlist: string[];
  isLoading: boolean;
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const fetchWishlist = async () => {
    if (!isAuthenticated) {
      setWishlist([]);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiGet<{ wishlist: string[] }>('/wishlist');
      setWishlist(response.wishlist || []);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      setWishlist([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addToWishlist = async (productId: string) => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      await apiPost(`/wishlist/${productId}`, {});
      setWishlist(prev => [...prev, productId]);
    } catch (error) {
      console.error('Failed to add to wishlist:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      await apiDelete(`/wishlist/${productId}`);
      setWishlist(prev => prev.filter(id => id !== productId));
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const isInWishlist = (productId: string): boolean => {
    return wishlist.includes(productId);
  };

  const refreshWishlist = async () => {
    await fetchWishlist();
  };

  useEffect(() => {
    fetchWishlist();
  }, [isAuthenticated, user]);

  const value: WishlistContextType = {
    wishlist,
    isLoading,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refreshWishlist,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
