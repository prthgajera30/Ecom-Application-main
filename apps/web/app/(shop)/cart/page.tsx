"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getSocket } from '../../../lib/ws';
import { useCartState } from '../../../context/CartContext';
import { ApiError } from '../../../lib/api';

type RecommendationItem = {
  score: number;
  product: {
    _id: string;
    title: string;
    slug?: string;
    price: number;
    images?: string[];
  } | null;
  productId?: string;
};

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { push } = useToast();
  const cart: ReturnType<typeof useCartState> = useCartState();
  const { items, products, subtotal, itemCount, loading, pending, error, updateItem, removeItem, beginCheckout } = cart;
  const [nudges, setNudges] = useState<RecommendationItem[]>([]);
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const handler = (payload: { items?: RecommendationItem[] }) => {
      setNudges(payload?.items || []);
    };
    socket.on('reco:nudge', handler);
    return () => {
      socket.off('reco:nudge', handler);
    };
  }, []);

  const pendingCheckout = Boolean(pending.checkout);

  const handleQtyChange = async (productId: string, qty: number) => {
    setInlineErrors((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    try {
      await updateItem(productId, qty);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update quantity.';
      setInlineErrors((current) => ({ ...current, [productId]: message }));
    }
  };

  const handleRemove = async (productId: string) => {
    setInlineErrors((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    try {
      await removeItem(productId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to remove item.';
      setInlineErrors((current) => ({ ...current, [productId]: message }));
    }
  };

  const startCheckout = async () => {
    setCheckoutError(null);
    if (!user) {
      const message = 'Sign in to complete checkout.';
      setCheckoutError(message);
      push({ variant: 'info', title: 'Login required', description: message });
      router.push('/login?next=/cart');
      return;
    }
    try {
      const url = await beginCheckout();
      if (url) window.location.href = url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to start checkout.';
      setCheckoutError(message);
    }
  };

  const isEmpty = !loading && itemCount === 0;

  const formattedSubtotal = useMemo(() => `$${(subtotal / 100).toFixed(2)}`, [subtotal]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-900/20 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Your Cart</h2>
            <p className="text-sm text-indigo-100/70">
              {itemCount
                ? `You have ${itemCount} item${itemCount === 1 ? '' : 's'} ready for checkout.`
                : 'Your cart is empty. Browse the catalog to add products.'}
            </p>
            {error && (
              <p className="mt-2 rounded-full bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                {error}
              </p>
            )}
          </div>
          {itemCount > 0 && (
            <Link href="/products" className="btn-secondary hidden sm:inline-flex">
              Continue shopping
            </Link>
          )}
        </div>

        {loading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="card animate-pulse space-y-4 p-4">
                <div className="h-20 rounded-2xl bg-white/10" />
                <div className="h-4 w-1/2 rounded-full bg-white/10" />
                <div className="h-4 w-1/3 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        ) : itemCount > 0 ? (
          <div className="mt-6 space-y-4">
            {items.map((item) => {
              const product = products[item.productId];
              const price = product?.price ?? 0;
              const pendingKey = pending[`update:${item.productId}`] || pending[`remove:${item.productId}`];
              return (
                <div
                  key={item.productId}
                  className="card space-y-4 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:space-y-0"
                >
                  <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                    <div className="h-28 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 sm:h-24 sm:w-24 sm:flex-shrink-0">
                      {product?.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-indigo-100/50">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-sm sm:space-y-2">
                      <div className="text-base font-semibold text-white">
                        {product?.title || 'Unnamed item'}
                      </div>
                      <div className="text-sm text-indigo-100/70">
                        ${(price / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-lg text-white transition hover:bg-white/15 disabled:opacity-50"
                        onClick={() => handleQtyChange(item.productId, item.qty - 1)}
                        aria-label={`Decrease quantity for ${product?.title || 'item'}`}
                        disabled={pendingKey}
                      >
                        -
                      </button>
                      <input
                        className="w-14 rounded-xl border border-white/15 bg-white/10 text-center text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                        value={item.qty}
                        onChange={(e) => handleQtyChange(item.productId, parseInt(e.target.value || '0', 10))}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`Quantity for ${product?.title || 'item'}`}
                        disabled={pendingKey}
                      />
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-lg text-white transition hover:bg-white/15 disabled:opacity-50"
                        onClick={() => handleQtyChange(item.productId, item.qty + 1)}
                        aria-label={`Increase quantity for ${product?.title || 'item'}`}
                        disabled={pendingKey}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:text-rose-100 disabled:opacity-60"
                      onClick={() => handleRemove(item.productId)}
                      disabled={pendingKey}
                    >
                      Remove
                    </button>
                  </div>
                  {inlineErrors[item.productId] && (
                    <p className="rounded-full bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                      {inlineErrors[item.productId]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-indigo-100/70">
            Nothing here yet.
            <Link href="/products" className="ml-2 text-white underline hover:text-indigo-200">
              Explore products
            </Link>
          </div>
        )}

        {itemCount > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-indigo-100/70">Subtotal</span>
              <span className="text-2xl font-semibold text-white">
                {formattedSubtotal}
              </span>
            </div>
            {checkoutError && (
              <p className="rounded-full bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                {checkoutError}
              </p>
            )}
            <button
              className="btn-primary w-full justify-center disabled:opacity-60"
              type="button"
              onClick={startCheckout}
              disabled={pendingCheckout}
            >
              {pendingCheckout ? 'Preparing checkout…' : 'Proceed to checkout'}
            </button>
          </div>
        )}
      </section>

      {nudges.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-900/20 backdrop-blur">
          <h3 className="text-lg font-semibold text-white">You might also like</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {nudges.map((item) => {
              const product = item.product;
              if (!product) return null;
              const href = product.slug ? `/product/${product.slug}` : '/products';
              return (
                <Link
                  key={product._id || item.productId}
                  href={href}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-indigo-400/60 hover:bg-white/10"
                >
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-900/40">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-indigo-100/50">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium text-white line-clamp-1">
                      {product.title || 'Product'}
                    </div>
                    <div className="text-xs text-indigo-100/70">
                      ${((product.price ?? 0) / 100).toFixed(2)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-indigo-100/50">
                      Match {(item.score ?? 0).toFixed(2)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
