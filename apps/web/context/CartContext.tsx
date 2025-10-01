"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiGet, apiPost, ApiError } from '../lib/api';
import { useToast } from './ToastContext';

export type CartItem = { productId: string; qty: number };
export type CartProduct = {
  _id: string;
  title: string;
  price: number;
  images?: string[];
  slug?: string;
};
export type CartResponse = {
  items: CartItem[];
  products?: Record<string, CartProduct>;
};

export type CartContextValue = {
  items: CartItem[];
  products: Record<string, CartProduct>;
  loading: boolean;
  error: string | null;
  itemCount: number;
  subtotal: number;
  pending: Record<string, boolean>;
  refresh: () => Promise<void>;
  addItem: (productId: string, qty?: number) => Promise<CartResponse>;
  updateItem: (productId: string, qty: number) => Promise<CartResponse>;
  removeItem: (productId: string) => Promise<CartResponse>;
  beginCheckout: (options?: { successUrl?: string; cancelUrl?: string }) => Promise<string>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeCart(payload: CartResponse | null | undefined): { items: CartItem[]; products: Record<string, CartProduct> } {
  return {
    items: Array.isArray(payload?.items) ? payload!.items.map((item) => ({ productId: item.productId, qty: Math.max(0, Number(item.qty) || 0) })) : [],
    products: payload?.products || {},
  };
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message || 'Something went wrong';
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { push } = useToast();
  const { user } = useAuth();
  const [cart, setCart] = useState<{ items: CartItem[]; products: Record<string, CartProduct> }>({ items: [], products: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const setPendingState = useCallback((key: string, value: boolean) => {
    setPending((current) => {
      const next = { ...current };
      if (value) next[key] = true; else delete next[key];
      return next;
    });
  }, []);

  const applyCart = useCallback((payload: CartResponse | null | undefined) => {
    const normalized = normalizeCart(payload);
    setCart(normalized);
    return normalized;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<CartResponse>('/cart');
      applyCart(next);
    } catch (err) {
      const message = resolveErrorMessage(err);
      setError(message);
      push({ variant: 'error', title: 'Cart unavailable', description: message });
    } finally {
      setLoading(false);
    }
  }, [applyCart, push]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh, user?.id]);

  const mutate = useCallback(
    async (
      key: string,
      action: () => Promise<CartResponse>,
      options?: { successMessage?: string; successDescription?: string }
    ) => {
      setPendingState(key, true);
      try {
        const next = await action();
        applyCart(next);
        setError(null);
        if (options?.successMessage) {
          push({ variant: 'success', title: options.successMessage, description: options.successDescription });
        }
        return next;
      } catch (err) {
        const message = resolveErrorMessage(err);
        setError(message);
        const variant = err instanceof ApiError && err.data?.error === 'STRIPE_NOT_CONFIGURED' ? 'info' : 'error';
        const title = variant === 'info' ? 'Checkout unavailable' : 'Cart update failed';
        push({ variant, title, description: message });
        throw err;
      } finally {
        setPendingState(key, false);
      }
    },
    [applyCart, push, setPendingState]
  );

  const addItem = useCallback(
    (productId: string, qty = 1) =>
      mutate(
        `add:${productId}`,
        () => apiPost<CartResponse>('/cart/add', { productId, qty }),
        { successMessage: 'Added to cart' }
      ),
    [mutate]
  );

  const updateItem = useCallback(
    (productId: string, qty: number) =>
      mutate(
        `update:${productId}`,
        () => apiPost<CartResponse>('/cart/update', { productId, qty })
      ),
    [mutate]
  );

  const removeItem = useCallback(
    (productId: string) =>
      mutate(
        `remove:${productId}`,
        () => apiPost<CartResponse>('/cart/remove', { productId })
      ),
    [mutate]
  );

  const beginCheckout = useCallback(
    async (options?: { successUrl?: string; cancelUrl?: string }) => {
      setPendingState('checkout', true);
      try {
        const payload = await apiPost<{ url?: string }>('/checkout/create-session', options || {});
        if (!payload?.url) throw new ApiError('Checkout session could not be created', 500);
        push({ variant: 'info', title: 'Redirecting to checkout…' });
        return payload.url;
      } catch (err) {
        const message = resolveErrorMessage(err);
        if (err instanceof ApiError && err.data?.error === 'STRIPE_NOT_CONFIGURED') {
          push({ variant: 'info', title: 'Stripe not configured', description: message });
        } else {
          push({ variant: 'error', title: 'Checkout failed', description: message });
        }
        throw err;
      } finally {
        setPendingState('checkout', false);
      }
    },
    [push, setPendingState]
  );

  const itemCount = useMemo(() => cart.items.reduce((acc, item) => acc + item.qty, 0), [cart.items]);
  const subtotal = useMemo(
    () =>
      cart.items.reduce((acc, item) => {
        const product = cart.products[item.productId];
        return acc + (product?.price || 0) * item.qty;
      }, 0),
    [cart]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: cart.items,
      products: cart.products,
      loading,
      error,
      itemCount,
      subtotal,
      pending,
      refresh,
      addItem,
      updateItem,
      removeItem,
      beginCheckout,
    }),
    [cart.items, cart.products, loading, error, itemCount, subtotal, pending, refresh, addItem, updateItem, removeItem, beginCheckout]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartState(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartState must be used within a CartProvider');
  return ctx;
}
