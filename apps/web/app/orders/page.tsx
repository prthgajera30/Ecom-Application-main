"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/api';

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!token) return;
      const res = await fetch(`${API_BASE}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setOrders(await res.json());
    }
    load();
  }, [token]);

  if (!token) return <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-indigo-100/70">Please login to view your orders.</p>;

  return (
    <div className="space-y-6">
      <div>
        <span className="badge">Order history</span>
        <h2 className="mt-3 text-2xl font-semibold text-white">Track your recent activity</h2>
        <p className="text-sm text-indigo-100/70">Orders recorded after checkout will appear here with payment status and totals.</p>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-indigo-100/70">No orders found yet. Complete a Stripe test checkout to seed one.</div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id} className="card p-5">
              <div className="flex items-center justify-between text-sm text-indigo-100/70">
                <span>Order ID</span>
                <span className="font-medium text-white">{o.id}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-indigo-100/70">
                <span>Status</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium capitalize text-white">{o.status}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-indigo-100/70">
                <span>Total</span>
                <span className="font-medium text-white">${((o.total || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="mt-4 text-xs text-indigo-100/60">Created {new Date(o.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
