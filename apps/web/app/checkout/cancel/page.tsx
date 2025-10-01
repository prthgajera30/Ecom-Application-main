"use client";
import Link from 'next/link';

export default function Cancel() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-10 text-center shadow-2xl shadow-rose-900/30">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-rose-300/60 bg-rose-500/20 text-3xl">⌛</div>
        <h2 className="mt-6 text-3xl font-semibold text-white">Checkout canceled</h2>
        <p className="mt-3 text-sm text-rose-100/80">
          Your Stripe test session was closed before completing payment. You can jump back to the cart to retry or keep browsing for more products.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <Link href="/cart" className="btn-primary">Return to cart</Link>
          <Link href="/products" className="btn-secondary">Browse catalog</Link>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-indigo-100/70">
        <h3 className="text-base font-semibold text-white">Need help?</h3>
        <p className="mt-2">Ensure test card details are entered correctly. You can also open the docs quick link from the mobile menu to review the payment flow.</p>
      </div>
    </div>
  );
}
