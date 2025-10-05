'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSessionId } from '../lib/session';
import { getSocket, identifySession } from '../lib/ws';
import { useCartState } from '../context/CartContext';
import { ThemeToggle } from './ThemeToggle';
import { Button, ButtonLink } from './ui/Button';
import { UserMenu } from './ui/UserMenu';

const navLinks = [
  { href: '/products', label: 'Products' },
  { href: '/wishlist', label: 'Wishlist' },
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
    <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]">
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
    <header className="sticky top-0 z-40 border-b border-[var(--surface-border)] bg-[color:var(--surface-solid)] backdrop-blur-2xl transition-colors">
      <div className="container flex items-center justify-between gap-3 py-3 sm:py-4">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-lg font-semibold text-white shadow-lg shadow-indigo-600/40 transition-transform group-hover:scale-105">
            PC
          </span>
          <div className="leading-tight max-sm:hidden">
            <span className="block text-sm font-semibold text-white sm:text-base">Pulse Commerce</span>
            <span className="block text-[11px] text-indigo-200/80 sm:text-xs">Realtime personalization suite</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1 transition-colors ${
                isActive(link.href) ? 'text-[var(--text-primary)]' : 'text-subtle hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{link.label}</span>
              {link.href === '/cart' && cartBadge}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle className="hidden md:inline-flex" />
          <ButtonLink href="/cart" variant="secondary" size="sm" className="relative md:hidden">
            Cart
            {cartBadge && (
              <span className="absolute -right-2 -top-2 inline-flex items-center justify-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                {itemCount}
              </span>
            )}
          </ButtonLink>
          {!user ? (
            <>
              <ButtonLink href="/login" variant="secondary" className="hidden md:inline-flex">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" className="hidden sm:inline-flex">
                Create account
              </ButtonLink>
            </>
          ) : (
            <UserMenu />
          )}
          <ThemeToggle className="md:hidden" />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden border border-white/15 bg-white/5 text-[var(--text-primary)] hover:bg-white/10"
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
          </Button>
        </div>
      </div>

      <div className="border-t border-[var(--surface-border)] bg-[color:var(--surface-solid)] md:hidden">
        <div className="container flex items-center gap-2 overflow-x-auto py-2 text-sm font-medium text-subtle">
          {navLinks.map((link) => (
            <Link
              key={`mobile-${link.href}`}
              href={link.href}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 transition ${
                isActive(link.href) ? 'bg-white/10 text-[var(--text-primary)]' : 'hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{link.label}</span>
              {link.href === '/cart' && cartBadge}
            </Link>
          ))}
        </div>
      </div>

      {drawerVisible && (
        <div className="md:hidden">
          <button
            type="button"
            aria-hidden="true"
            className={`fixed inset-0 z-30 bg-black/55 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={closeMobile}
          />
          <div
            className={`fixed top-0 right-0 z-40 flex w-[min(20rem,85vw)] transform flex-col border-l border-[var(--surface-border)] bg-[color:var(--surface-solid)] px-6 pb-6 pt-5 shadow-2xl shadow-slate-950/30 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold uppercase tracking-wider text-subtle">
                Menu
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle className="h-11 w-11 shrink-0 rounded-xl border border-[var(--surface-border)] bg-[color:var(--surface-strong)]" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-0 rounded-xl border border-[var(--surface-border)] bg-[color:var(--surface-strong)] px-3 py-2 text-[var(--text-primary)]/80 hover:text-[var(--text-primary)]"
                  onClick={closeMobile}
                >
                  Close
                </Button>
              </div>
            </div>
            <nav className="flex flex-col gap-2 text-[var(--text-primary)]/80">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition ${
                    isActive(link.href)
                      ? 'bg-[color:var(--surface-muted)] text-[var(--text-primary)]'
                      : 'bg-[color:var(--surface-strong)] hover:bg-[color:var(--surface-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={closeMobile}
                >
                  <span className="flex items-center gap-2">
                    <span>{link.label}</span>
                    {link.href === '/cart' && cartBadge}
                  </span>
                </Link>
              ))}
              {user && (
                <Link
                  href="/profile"
                  className={`rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-medium transition ${
                    isActive('/profile')
                      ? 'bg-[color:var(--surface-muted)] text-[var(--text-primary)]'
                      : 'bg-[color:var(--surface-strong)] hover:bg-[color:var(--surface-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={closeMobile}
                >
                  <span>Profile</span>
                </Link>
              )}
            </nav>
            <div className="mt-6 space-y-3">
              {!user ? (
                <>
                  <ButtonLink
                    href="/login"
                    variant="secondary"
                    className="w-full justify-center rounded-xl border border-[var(--surface-border)] bg-[color:var(--surface-strong)] text-[var(--text-primary)]/85 hover:text-[var(--text-primary)]"
                    onClick={closeMobile}
                  >
                    Sign in
                  </ButtonLink>
                  <ButtonLink
                    href="/register"
                    className="w-full justify-center rounded-xl border border-[var(--surface-border)] bg-[color:var(--surface-muted)] text-[var(--surface-solid)] hover:bg-[color:var(--surface-strong)] hover:text-[var(--text-primary)]"
                    onClick={closeMobile}
                  >
                    Create account
                  </ButtonLink>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-[var(--surface-border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-subtle">
                    <span className="text-xs uppercase tracking-wider text-subtle">
                      Signed in
                    </span>
                    <span className="mt-1 block truncate text-[var(--text-primary)]">{user.email}</span>
                  </div>
                  <Button variant="secondary" className="w-full justify-center" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              )}
            </div>
            <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[color:var(--surface-strong)] p-4 text-sm text-subtle" data-testid="mobile-cart-summary">
              <div className="flex items-center justify-between">
                <span>Cart</span>
                <span className="font-semibold text-[var(--text-primary)]">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-subtle">
                <span>Subtotal</span>
                <span className="font-medium text-[var(--text-primary)]">${(subtotal / 100).toFixed(2)}</span>
              </div>
              <Button
                className="mt-4 w-full justify-center"
                onClick={startCheckout}
                disabled={!itemCount || Boolean(pending.checkout)}
              >
                {pending.checkout ? 'Preparing checkout…' : 'Checkout'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
