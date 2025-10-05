"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { useCartState } from '../../../context/CartContext';
import { useToast } from '../../../context/ToastContext';
import { API_BASE } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
 // Icons removed due to package compatibility issues

type OrderItem = {
  productId: string;
  title?: string;
  price: number;
  qty: number;
  variantId?: string | null;
  variantLabel?: string | null;
  variantOptions?: Record<string, string>;
};

type Order = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  currency: string;
  createdAt: string;
  shippingAddress?: any;
  shippingOption?: any;
  items: OrderItem[];
  canReorder: boolean;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const { addMultipleItems } = useCartState();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      if (!token || !id) return;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Order not found');
          }
          throw new Error('Could not fetch order');
        }

        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load order right now.');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [token, id]);

  const handleReorder = async () => {
    if (!order || !token) return;

    setReorderLoading(true);
    try {
      // Prepare reorder - this gives us the cart items to add
      const res = await fetch(`${API_BASE}/orders/${order.id}/reorder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to prepare reorder');
      }

      const data = await res.json();

      // Convert cartItems to the format expected by addMultipleItems
      const itemsToAdd = data.cartItems.map((item: any) => ({
        productId: item.productId,
        qty: item.qty,
        options: {
          variantId: item.variantId,
          variantLabel: item.variantLabel,
          variantOptions: item.variantOptions,
        }
      }));

      // Add all items to cart at once
      await addMultipleItems(itemsToAdd);

      push({
        variant: 'success',
        title: 'Items added to cart',
        description: `${data.cartItems.length} items from your order have been added to your cart.`,
      });

      // Navigate to cart
      router.push('/cart');
    } catch (err) {
      push({
        variant: 'error',
        title: 'Reorder failed',
        description: err instanceof Error ? err.message : 'Unable to reorder at this time.',
      });
    } finally {
      setReorderLoading(false);
    }
  };

  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  if (!token) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-indigo-100/70">
        Please login to view your order details.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="card-elevated max-w-lg space-y-4 p-8">
          <div className="h-4 w-32 rounded-full bg-white/10" />
          <div className="h-6 w-48 rounded-full bg-white/10" />
          <div className="space-y-3">
            <div className="h-12 rounded-xl bg-white/10" />
            <div className="h-12 rounded-xl bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <Card className="max-w-lg p-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white mb-4">Order Not Found</h2>
            <p className="text-indigo-100/70 mb-6">{error}</p>
            <Link href="/orders" className="btn-primary">
              Back to Orders
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-indigo-200 hover:text-white mb-4">
          <span className="text-sm">⬅</span>
          Back to orders
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Order #{order.id.slice(-8)}</h1>
            <p className="text-indigo-100/70 mt-1">
              Ordered on {new Date(order.createdAt).toLocaleDateString()} at{' '}
              {new Date(order.createdAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              order.status === 'paid' ? 'bg-green-500/20 text-green-200' :
              order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-200' :
              'bg-gray-500/20 text-gray-200'
            }`}>
              {order.status.toUpperCase()}
            </div>
            <div className="text-2xl font-semibold text-white mt-2">
              {formatPrice(order.total)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Order Items */}
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Order Items</h2>
              <div className="space-y-6">
                {order.items.map((item, idx) => (
                  <div key={`${item.productId}-${item.variantId}-${idx}`} className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-lg bg-white/10 flex items-center justify-center text-xs text-white/60">
                      {item.qty}x
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-white">{item.title || 'Product'}</h3>
                          {item.variantLabel && (
                            <p className="text-sm text-indigo-100/60 mt-1">{item.variantLabel}</p>
                          )}
                          {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                            <div className="text-xs text-indigo-100/50 mt-1">
                              {Object.entries(item.variantOptions).map(([key, value]) => `${key}: ${value}`).join(', ')}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-medium text-white">
                            {formatPrice(item.price * item.qty)}
                          </div>
                          <div className="text-sm text-indigo-100/70">
                            {item.qty}x {formatPrice(item.price)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reorder Button */}
              {order.canReorder && (
                <div className="border-t border-white/10 pt-6 mt-6">
                  <Button
                    onClick={handleReorder}
                    disabled={reorderLoading}
                    className="w-full justify-center"
                  >
                    {reorderLoading ? 'Adding items to cart...' : 'Reorder This Entire Order'}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl text-indigo-400">📍</span>
                  <h3 className="text-lg font-semibold text-white">Shipping Address</h3>
                </div>
                <div className="text-sm text-indigo-100/80 space-y-1">
                  <div className="font-medium text-white">{order.shippingAddress.fullName}</div>
                  <div>{order.shippingAddress.line1}</div>
                  {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
                  <div>
                    {order.shippingAddress.city}, {order.shippingAddress.state && `${order.shippingAddress.state}, `}{order.shippingAddress.postalCode}
                  </div>
                  <div>{order.shippingAddress.country}</div>
                  {order.shippingAddress.phone && (
                    <div className="mt-2 text-indigo-100/70">{order.shippingAddress.phone}</div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar - Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-xl text-indigo-400">💳</span>
                <h3 className="text-lg font-semibold text-white">Order Summary</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-indigo-100/70">Order ID</span>
                  <span className="text-white font-mono text-xs">{order.id.slice(-12)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-indigo-100/70">Date</span>
                  <span className="text-white">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-indigo-100/70">Status</span>
                  <span className={`font-medium ${
                    order.status === 'paid' ? 'text-green-200' :
                    order.status === 'pending' ? 'text-yellow-200' :
                    'text-gray-200'
                  }`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>

                <hr className="border-white/10" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-indigo-100/70">Subtotal</span>
                    <span className="text-white">{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-100/70">Shipping</span>
                    <span className="text-white">{order.shippingAmount ? formatPrice(order.shippingAmount) : 'Free'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-100/70">Tax</span>
                    <span className="text-white">{formatPrice(order.taxAmount)}</span>
                  </div>
                  <hr className="border-white/10" />
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-white">Total</span>
                    <span className="text-white">{formatPrice(order.total)}</span>
                  </div>
                  <div className="text-xs text-center text-indigo-100/60">
                    {order.currency.toUpperCase()}
                  </div>
                </div>
              </div>

              {order.shippingOption && (
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg text-indigo-400">🚚</span>
                    <div className="text-sm">
                      <div className="font-medium text-white">{order.shippingOption.name}</div>
                      <div className="text-indigo-100/70">{formatPrice(order.shippingOption.amount)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
