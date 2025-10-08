"use client";
import Link from 'next/link';

export default function Cancel() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="rounded-3xl border border-[var(--danger)]/30 bg-[var(--danger-10)] p-10 text-center shadow-2xl shadow-[var(--danger)]/30">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--danger)]/60 bg-[var(--danger-10)] text-3xl">⌛</div>
        <h2 className="mt-6 text-3xl font-semibold text-primary">Checkout canceled</h2>
        <p className="mt-3 text-sm text-[var(--danger-100)]/80">
          Your Stripe test session was closed before completing payment. You can jump back to the cart to retry or keep browsing for more products.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <Link href="/cart" className="btn-primary">Return to cart</Link>
          <Link href="/products" className="btn-secondary">Browse catalog</Link>
        </div>
      </div>
      <div className="rounded-2xl border border-ghost-10 bg-ghost-5 p-6 text-sm text-muted">
        <h3 className="text-base font-semibold text-primary">Need help?</h3>
        <p className="mt-2">Ensure test card details are entered correctly. You can also open the docs quick link from the mobile menu to review the payment flow.</p>
      </div>
    </div>
  );
}
