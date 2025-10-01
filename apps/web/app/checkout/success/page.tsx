"use client";
import Link from 'next/link';
import { useEffect } from 'react';
import { useCartState } from '../../../context/CartContext';

export default function Success() {
  const { refresh } = useCartState();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-10 text-center shadow-2xl shadow-emerald-900/30">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-500/20 text-3xl">🎉</div>
        <h2 className="mt-6 text-3xl font-semibold text-white">Checkout complete</h2>
        <p className="mt-3 text-sm text-emerald-100/80">
          Thanks for running a Stripe test payment. Jump into the orders dashboard or keep exploring the catalog to trigger more realtime events.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <Link href="/orders" className="btn-primary">View orders</Link>
          <Link href="/products" className="btn-secondary">Continue shopping</Link>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-indigo-100/70 text-left">
        <h3 className="text-base font-semibold text-white">What to try next</h3>
        <ul className="mt-3 space-y-2">
          <li>• Inspect the API logs to confirm the session webhook fired.</li>
          <li>• Seed additional products, then rerun checkout to compare totals.</li>
          <li>• Use the mobile drawer checkout shortcut for a quick repeat test.</li>
        </ul>
      </div>
    </div>
  );
}
