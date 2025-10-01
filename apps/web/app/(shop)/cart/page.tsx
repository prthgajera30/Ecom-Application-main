"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../lib/api';
import { getSocket } from '../../../lib/ws';

type CartItem = { productId: string; qty: number };
type Product = { _id: string; title: string; slug?: string; price: number; images?: string[] };

type CartResponse = {
  items: CartItem[];
  products?: Record<string, Product>;
};

type RecommendationItem = {
  score: number;
  product: Product | null;
  productId?: string;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [nudges, setNudges] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    apiGet<CartResponse>('/cart')
      .then(({ items, products = {} }) => {
        setCart(items);
        setProducts(products);
      })
      .catch(() => {
        setCart([]);
        setProducts({});
      });
  }, []);

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

  const total = useMemo(
    () =>
      cart.reduce((acc, item) => {
        const product = products[item.productId];
        return acc + (product?.price || 0) * item.qty;
      }, 0),
    [cart, products]
  );

  async function remove(productId: string) {
    const next = await apiPost<CartResponse>('/cart/remove', { productId });
    setCart(next.items);
    setProducts(next.products || {});
  }

  async function updateQty(productId: string, qty: number) {
    const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    if (safeQty <= 0) {
      await remove(productId);
      return;
    }
    const next = await apiPost<CartResponse>('/cart/update', { productId, qty: safeQty });
    setCart(next.items);
    setProducts(next.products || {});
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Cart</h2>
        {cart.length === 0 && <p>Your cart is empty.</p>}
        <div className="space-y-3">
          {cart.map((item) => {
            const product = products[item.productId];
            return (
              <div key={item.productId} className="card flex items-center gap-4 p-4">
                {product?.images?.[0] ? (
                  <img src={product.images[0]} alt={product.title} className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{product?.title || item.productId}</div>
                  <div className="text-sm text-gray-600">${((product?.price || 0) / 100).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-lg text-white hover:bg-white/15" onClick={() => updateQty(item.productId, item.qty - 1)}>-</button>
                  <input
                    className="w-12 rounded-xl border border-white/15 bg-white/10 text-center text-sm text-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    value={item.qty}
                    onChange={(e) => updateQty(item.productId, parseInt(e.target.value || '0', 10))}
                  />
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-lg text-white hover:bg-white/15" onClick={() => updateQty(item.productId, item.qty + 1)}>+</button>
                </div>
                <button className="text-xs font-semibold uppercase tracking-wide text-rose-200 hover:text-rose-100" onClick={() => remove(item.productId)}>Remove</button>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="text-gray-600">Subtotal</div>
          <div className="text-lg font-semibold">${(total / 100).toFixed(2)}</div>
        </div>
        <div className="mt-4">
          <button className="btn-primary w-full">Proceed to Checkout</button>
        </div>
      </div>

      {nudges.length > 0 && (
        <section className="rounded border border-gray-200 p-4 bg-white">
          <h3 className="text-lg font-semibold mb-3">You might also like</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nudges.map((item) => {
              const product = item.product;
              if (!product) return null;
              return (
                <Link key={product._id || item.productId} href={product.slug ? `/product/${product.slug}` : '#'} className="flex gap-3">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.title} className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded" />
                  )}
                  <div>
                    <div className="font-medium line-clamp-1">{product.title}</div>
                    <div className="text-sm text-gray-600">${(product.price / 100).toFixed(2)}</div>
                    <div className="text-xs text-gray-400">Match {(item.score ?? 0).toFixed(2)}</div>
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
