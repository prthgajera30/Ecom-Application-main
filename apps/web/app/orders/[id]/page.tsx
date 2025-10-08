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
      <div className="rounded-3xl border border-ghost-10 bg-ghost-5 p-8 text-sm text-muted">
        Please login to view your order details.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="card-elevated max-w-lg space-y-4 p-8">
          <div className="h-4 w-32 rounded-full bg-ghost-10" />
          <div className="h-6 w-48 rounded-full bg-ghost-10" />
          <div className="space-y-3">
            <div className="h-12 rounded-xl bg-ghost-10" />
            <div className="h-12 rounded-xl bg-ghost-10" />
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
            <h2 className="text-xl font-semibold text-primary mb-4">Order Not Found</h2>
            <p className="text-muted mb-6">{error}</p>
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
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary mb-4">
          <span className="text-sm">⬅</span>
          Back to orders
        </Link>
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-primary">Order #{order.id.slice(-8)}</h1>
            <p className="text-muted mt-1">
              Ordered on {new Date(order.createdAt).toLocaleDateString()} at{' '}
              {new Date(order.createdAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              order.status === 'paid' ? 'bg-[color:var(--brand)]/20 text-[color:var(--brand)]' :
              order.status === 'pending' ? 'bg-[color:var(--accent)]/20 text-[color:var(--accent)]' :
              'bg-ghost-10 text-muted'
            }`}>
              {order.status.toUpperCase()}
            </div>
            <div className="text-2xl font-semibold text-primary mt-2">
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
              <h2 className="text-xl font-semibold text-primary mb-6">Order Items</h2>
              <div className="space-y-6">
                {order.items.map((item, idx) => (
                  <div key={`${item.productId}-${item.variantId}-${idx}`} className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-lg bg-ghost-10 flex items-center justify-center text-xs text-muted">
                      {item.qty}x
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-primary">{item.title || 'Product'}</h3>
                          {item.variantLabel && (
                            <p className="text-sm text-muted mt-1">{item.variantLabel}</p>
                          )}
                          {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                            <div className="text-xs text-muted mt-1">
                              {Object.entries(item.variantOptions).map(([key, value]) => `${key}: ${value}`).join(', ')}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-medium text-primary">
                            {formatPrice(item.price * item.qty)}
                          </div>
                          <div className="text-sm text-muted">
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
                <div className="border-t border-ghost-10 pt-6 mt-6">
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
                  <span className="text-xl text-[var(--brand)]">📍</span>
                  <h3 className="text-lg font-semibold text-primary">Shipping Address</h3>
                </div>
                <div className="text-sm text-muted space-y-1">
                  <div className="font-medium text-primary">{order.shippingAddress.fullName}</div>
                  <div>{order.shippingAddress.line1}</div>
                  {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
                  <div>
                    {order.shippingAddress.city}, {order.shippingAddress.state && `${order.shippingAddress.state}, `}{order.shippingAddress.postalCode}
                  </div>
                  <div>{order.shippingAddress.country}</div>
                  {order.shippingAddress.phone && (
                    <div className="mt-2 text-muted">{order.shippingAddress.phone}</div>
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
                <span className="text-xl text-[var(--brand)]">💳</span>
                <h3 className="text-lg font-semibold text-primary">Order Summary</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Order ID</span>
                  <span className="text-primary font-mono text-xs">{order.id.slice(-12)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Date</span>
                  <span className="text-primary">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Status</span>
                  <span className={`font-medium ${
                    order.status === 'paid' ? 'text-[color:var(--brand)]' :
                    order.status === 'pending' ? 'text-[var(--accent)]' :
                    'text-muted'
                  }`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>

                <hr className="border-ghost-10" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Subtotal</span>
                    <span className="text-primary">{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Shipping</span>
                    <span className="text-primary">{order.shippingAmount ? formatPrice(order.shippingAmount) : 'Free'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Tax</span>
                    <span className="text-primary">{formatPrice(order.taxAmount)}</span>
                  </div>
                  <hr className="border-ghost-10" />
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-primary">Total</span>
                    <span className="text-primary">{formatPrice(order.total)}</span>
                  </div>
                  <div className="text-xs text-center text-subtle">
                    {order.currency.toUpperCase()}
                  </div>
                </div>
              </div>

              {order.shippingOption && (
                <div className="border-t border-ghost-10 pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg text-[var(--brand)]">🚚</span>
                    <div className="text-sm">
                      <div className="font-medium text-primary">{order.shippingOption.name}</div>
                      <div className="text-muted">{formatPrice(order.shippingOption.amount)}</div>
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
