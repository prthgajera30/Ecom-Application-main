"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiGet, apiPost, ApiError } from '../lib/api';
import { useToast } from './ToastContext';


export type CartItem = {
  productId: string;
  qty: number;
  variantId?: string | null;
  variantLabel?: string | null;
  variantOptions?: Record<string, string>;
  unitPrice?: number | null;
  variantImage?: string;
};

export type CartProduct = {
  _id: string;
  title: string;
  price: number;
  images?: string[];
  slug?: string;
  brand?: string;
  variants?: Array<{
    variantId?: string;
    label?: string;
    price?: number;
    stock?: number;
    options?: Record<string, string>;
    images?: string[];
  }>;
};

export type CartResponse = {
  items: CartItem[];
  products?: Record<string, CartProduct>;
};


export type AddItemOptions = {
  variantId?: string;
  variantLabel?: string;
  variantOptions?: Record<string, string>;
  unitPrice?: number;
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
  addItem: (productId: string, qty?: number, options?: AddItemOptions) => Promise<CartResponse>;
  addMultipleItems: (items: Array<{ productId: string; qty: number; options?: AddItemOptions }>) => Promise<CartResponse>;
  updateItem: (productId: string, qty: number, options?: { variantId?: string | null }) => Promise<CartResponse>;
  removeItem: (productId: string, options?: { variantId?: string | null }) => Promise<CartResponse>;
  beginCheckout: (options?: { successUrl?: string; cancelUrl?: string }) => Promise<string>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);


function makeLineKey(productId: string, variantId?: string | null) {
  return variantId ? `${productId}::${variantId}` : productId;
}

function normalizeCart(payload: CartResponse | null | undefined): { items: CartItem[]; products: Record<string, CartProduct> } {
  const items = Array.isArray(payload?.items)
    ? payload!.items.map((item) => ({
        productId: item.productId,
        qty: Math.max(0, Number(item.qty) || 0),
        variantId: item.variantId ?? null,
        variantLabel: item.variantLabel ?? null,
        variantOptions: item.variantOptions ?? undefined,
        unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined,
        variantImage: item.variantImage,
      }))
    : [];
  return {
    items,
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
  (productId: string, qty = 1, options?: AddItemOptions) => {
    const lineKey = makeLineKey(productId, options?.variantId || options?.variantLabel ? options?.variantId ?? null : undefined);
    return mutate(
      `add:${lineKey}`,
      () => apiPost<CartResponse>('/cart/add', { productId, qty, ...options }),
      { successMessage: 'Added to cart' }
    );
  },
  [mutate]
);

const addMultipleItems = useCallback(
  async (items: Array<{ productId: string; qty: number; options?: AddItemOptions }>) => {
    // Batch add items by calling cart/add for each item sequentially
    // but don't show individual "Added to cart" toasts for each item
    const results = [];
    for (const item of items) {
      try {
        const result = await mutate(
          `reorder-${item.productId}`,
          () => apiPost<CartResponse>('/cart/add', {
            productId: item.productId,
            qty: item.qty,
            ...item.options
          })
        );
        results.push(result);
      } catch (error) {
        console.warn('Failed to add item to cart:', item.productId, error);
        // Continue with other items even if one fails
      }
    }

    // Return the final cart state
    const finalCart = await apiGet<CartResponse>('/cart');
    applyCart(finalCart);
    return finalCart;
  },
  [mutate, applyCart]
);

const updateItem = useCallback(
  (productId: string, qty: number, options?: { variantId?: string | null }) => {
    const lineKey = makeLineKey(productId, options?.variantId ?? null);
    return mutate(
      `update:${lineKey}`,
      () => apiPost<CartResponse>('/cart/update', { productId, qty, variantId: options?.variantId ?? undefined })
    );
  },
  [mutate]
);

const removeItem = useCallback(
  (productId: string, options?: { variantId?: string | null }) => {
    const lineKey = makeLineKey(productId, options?.variantId ?? null);
    return mutate(
      `remove:${lineKey}`,
      () => apiPost<CartResponse>('/cart/remove', { productId, variantId: options?.variantId ?? undefined })
    );
  },
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
      const unit = Number.isFinite(item.unitPrice) ? Number(item.unitPrice) : product?.price || 0;
      return acc + unit * item.qty;
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
      addMultipleItems,
      updateItem,
      removeItem,
      beginCheckout,
    }),
    [cart.items, cart.products, loading, error, itemCount, subtotal, pending, refresh, addItem, addMultipleItems, updateItem, removeItem, beginCheckout]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartState(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartState must be used within a CartProvider');
  return ctx;
}
