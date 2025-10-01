"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/api';

type Order = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
};

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
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

  if (!token) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-indigo-100/70">
        Please login to view your orders.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="badge">Order history</span>
        <h2 className="mt-3 text-2xl font-semibold text-white">Track your recent activity</h2>
        <p className="text-sm text-indigo-100/70">Orders recorded after checkout will appear here with payment status and totals.</p>
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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-indigo-100/70">No orders found yet. Complete a Stripe test checkout to seed one.</div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id} className="card space-y-4 p-5">
              <div className="flex items-center justify-between text-sm text-indigo-100/70">
                <span>Order ID</span>
                <span className="font-medium text-white">{o.id}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-indigo-100/70">
                <span>Status</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium capitalize text-white">{o.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-indigo-100/70">
                <span>Total</span>
                <span className="font-medium text-white">${((o.total || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="text-xs text-indigo-100/50">Created {new Date(o.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
