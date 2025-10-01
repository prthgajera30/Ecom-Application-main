'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSessionId } from '../lib/session';
import { getSocket, identifySession } from '../lib/ws';
import { useCartState } from '../context/CartContext';

const navLinks = [
  { href: '/products', label: 'Products' },
  { href: '/cart', label: 'Cart' },
  { href: '/orders', label: 'Orders' },
];

const quickLinks = [
  { href: '/profile', label: 'Profile', requiresAuth: true },
  { href: 'https://github.com/', label: 'Support', external: true },
];

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { itemCount, subtotal, pending, beginCheckout } = useCartState();

  useEffect(() => {
    const sessionId = getSessionId();
    identifySession(sessionId);
    const socket = getSocket();
    if (user?.id) {
      socket.emit('user:identify', { userId: user.id });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const { style } = document.body;
    const previous = style.overflow;
    style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      setDrawerVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setDrawerVisible(false), 250);
    return () => window.clearTimeout(timer);
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);
  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const handleLogout = () => {
    logout();
    closeMobile();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const cartBadge = itemCount > 0 ? (
    <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
      {itemCount}
    </span>
  ) : null;

  const startCheckout = async () => {
    closeMobile();
    if (!user) {
      push({ variant: 'info', title: 'Login required', description: 'Sign in before checking out.' });
      router.push('/login?next=/cart');
      return;
    }
    try {
      const url = await beginCheckout();
      if (url) window.location.href = url;
    } catch (err) {
      /* toast handled in beginCheckout */
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-lg font-semibold text-white shadow-lg shadow-indigo-600/40 transition group-hover:scale-105">
            PC
          </span>
          <div className="leading-tight">
            <span className="block text-base font-semibold text-white">Pulse Commerce</span>
            <span className="block text-xs text-indigo-200/80">Realtime personalization suite</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1 transition ${isActive(link.href) ? 'text-white' : 'text-indigo-100/70 hover:text-white'}`}
            >
              <span>{link.label}</span>
              {link.href === '/cart' && cartBadge}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/cart"
            className="btn-secondary relative px-4 py-1.5 text-xs font-semibold md:hidden"
          >
            Cart
            {cartBadge && (
              <span className="absolute -right-2 -top-2 inline-flex items-center justify-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                {itemCount}
              </span>
            )}
          </Link>
          {!user ? (
            <>
              <Link href="/login" className="btn-secondary hidden md:inline-flex">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary hidden sm:inline-flex">
                Create account
              </Link>
            </>
          ) : (
            <>
              <span className="hidden text-sm font-medium text-indigo-100/80 sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                className="btn-secondary hidden md:inline-flex"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
            onClick={toggleMobile}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden="true" className="flex h-4 flex-col justify-between">
              <span
                className={`h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${mobileOpen ? 'translate-y-1.5 rotate-45' : ''}`}
              />
              <span
                className={`h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : 'opacity-100'}`}
              />
              <span
                className={`h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${mobileOpen ? '-translate-y-1.5 -rotate-45' : ''}`}
              />
            </span>
          </button>
        </div>
      </div>

      {drawerVisible && (
        <div className="md:hidden">
          <button
            type="button"
            aria-hidden="true"
            className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={closeMobile}
          />
          <div
            className={`fixed top-0 right-0 z-40 flex h-full w-72 max-w-[80%] transform flex-col border-l border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-indigo-950/40 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wider text-indigo-100/70">
                Menu
              </span>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-100/80 transition hover:bg-white/10"
                onClick={closeMobile}
              >
                Close
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    isActive(link.href)
                      ? 'bg-white/10 text-white'
                      : 'text-indigo-100/80 hover:bg-white/5 hover:text-white'
                  }`}
                  onClick={closeMobile}
                >
                  <span className="flex items-center gap-2">
                    <span>{link.label}</span>
                    {link.href === '/cart' && cartBadge}
                  </span>
                </Link>
              ))}
            </nav>
            <div className="mt-6 space-y-3">
              {!user ? (
                <>
                  <Link href="/login" className="btn-secondary w-full justify-center" onClick={closeMobile}>
                    Sign in
                  </Link>
                  <Link href="/register" className="btn-primary w-full justify-center" onClick={closeMobile}>
                    Create account
                  </Link>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-indigo-100/80">
                    <span className="text-xs uppercase tracking-wider text-indigo-100/50">
                      Signed in
                    </span>
                    <span className="mt-1 block truncate text-white">{user.email}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary w-full justify-center"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
            <div className="mt-6 space-y-3">
              <div className="text-xs uppercase tracking-wide text-indigo-100/50">Quick links</div>
              {quickLinks
                .filter((link) => (link.requiresAuth ? Boolean(user) : true))
                .map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noreferrer' : undefined}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-indigo-100/80 transition hover:bg-white/5 hover:text-white"
                    onClick={link.external ? closeMobile : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-indigo-100/80" data-testid="mobile-cart-summary">
              <div className="flex items-center justify-between">
                <span>Cart</span>
                <span className="font-semibold text-white">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-indigo-100/70">
                <span>Subtotal</span>
                <span className="font-medium text-white">${(subtotal / 100).toFixed(2)}</span>
              </div>
              <button
                type="button"
                className="btn-primary mt-4 w-full justify-center"
                onClick={startCheckout}
                disabled={!itemCount || Boolean(pending.checkout)}
              >
                {pending.checkout ? 'Preparing checkout…' : 'Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

