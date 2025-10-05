"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useCartState } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
 // Icon removed temporarily due to package issues

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

export default function OrdersPage() {
  const { token } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const { addMultipleItems } = useCartState();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        setOrders([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/orders`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Could not fetch orders');
        const data = await res.json();
        setOrders(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load orders right now.');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const handleReorder = async (orderId: string) => {
    if (!token) return;

    setReorderLoading(orderId);
    try {
      console.log('Starting reorder for order:', orderId);

      // Prepare reorder - this gives us the cart items to add
      const res = await fetch(`${API_BASE}/orders/${orderId}/reorder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to prepare reorder');
      }

      const data = await res.json();
      console.log('Reorder data received:', data);

      if (!data.cartItems || data.cartItems.length === 0) {
        throw new Error('No items found in this order');
      }

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

      console.log('Items to add:', itemsToAdd);

      // Add all items to cart at once
      await addMultipleItems(itemsToAdd);

      push({
        variant: 'success',
        title: 'Items added to cart',
        description: `${data.cartItems.length} items from your previous order have been added to your cart.`,
      });

      // Navigate to cart
      router.push('/cart');
    } catch (err) {
      console.error('Reorder error:', err);
      push({
        variant: 'error',
        title: 'Reorder failed',
        description: err instanceof Error ? err.message : 'Unable to reorder at this time.',
      });
    } finally {
      setReorderLoading(null);
    }
  };

  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  if (!token) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-indigo-100/70">
        Please login to view your orders.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <span className="badge">Order history</span>
        <h2 className="mt-3 text-2xl font-semibold text-white">Your Orders</h2>
        <p className="text-sm text-indigo-100/70">
          View your order history and quickly reorder your favorite items.
        </p>
        {error && (
          <p className="mt-3 rounded-full bg-rose-500/15 px-4 py-2 text-xs text-rose-100">{error}</p>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="card animate-pulse p-5">
              <div className="h-4 w-2/3 rounded-full bg-white/10" />
              <div className="mt-4 h-4 w-1/2 rounded-full bg-white/10" />
              <div className="mt-4 h-4 w-1/3 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-8">
          <div className="text-center text-indigo-100/70">
            <p className="mb-4">No orders found yet.</p>
            <p className="text-sm mb-6">Complete a checkout to see your order history.</p>
            <Link href="/products" className="btn-primary">
              Start Shopping
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {orders.map((order) => (
            <Card key={order.id} className="p-6">
              <div className="space-y-4">
                {/* Order Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">Order #{order.id.slice(-8)}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'paid' ? 'bg-green-500/20 text-green-200' :
                        order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-200' :
                        'bg-gray-500/20 text-gray-200'
                      }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-indigo-100/50">
                      {new Date(order.createdAt).toLocaleDateString()} at{' '}
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">
                      {formatPrice(order.total)}
                    </div>
                    <div className="text-xs text-indigo-100/60">
                      {order.currency.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Order Items Summary */}
                <div className="border-t border-white/10 pt-4">
                  <div className="text-sm font-medium text-white mb-2">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </div>
                  <div className="space-y-2">
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="text-indigo-100/80 block truncate">
                            {item.title || 'Product'}
                          </span>
                          {item.variantLabel && (
                            <span className="text-xs text-indigo-100/60">{item.variantLabel}</span>
                          )}
                        </div>
                        <div className="text-white ml-2">
                          {item.qty}x {formatPrice(item.price)}
                        </div>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="text-xs text-indigo-100/60 text-center pt-2">
                        +{order.items.length - 3} more item{order.items.length - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="border-t border-white/10 pt-4 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-indigo-100/70">Subtotal</span>
                    <span className="text-indigo-100/80">{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-100/70">Shipping</span>
                    <span className="text-indigo-100/80">{order.shippingAmount ? formatPrice(order.shippingAmount) : 'Free'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-100/70">Tax</span>
                    <span className="text-indigo-100/80">{formatPrice(order.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-white pt-1 border-t border-white/10">
                    <span>Total</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  {order.canReorder && (
                    <Button
                      onClick={() => handleReorder(order.id)}
                      disabled={reorderLoading === order.id}
                      className="flex-1 justify-center text-sm"
                      size="sm"
                    >
                      {reorderLoading === order.id ? 'Adding...' : 'Reorder'}
                    </Button>
                  )}
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex-1 btn-secondary justify-center text-sm"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
