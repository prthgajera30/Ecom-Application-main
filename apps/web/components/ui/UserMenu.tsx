"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCartState } from '../../context/CartContext';
import { Button, ButtonLink } from './Button';
import { Card } from './Card';

export function UserMenu() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { itemCount, pending, beginCheckout } = useCartState();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    // After logging out, navigate back to the homepage to match test expectations
    try {
      if (typeof window !== 'undefined') window.location.assign('/');
      else router.push('/');
    } catch (err) {
      // ignore - navigation might not be available in some test harnesses
    }
  };

  const startCheckout = async () => {
    setIsOpen(false);
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

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        data-testid="user-menu"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-surface-strong px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-surface-muted"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
            <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--brand)] to-[color:var(--brand-dark)]">
            <span className="text-sm font-bold fixed-white">
              {user.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="hidden sm:inline text-xs text-[var(--text-subtle)]">
            {user.email?.split('@')[0]}
          </span>
        </div>
        <span className={`text-subtle transition-transform text-sm ${isOpen ? 'rotate-180 inline-block' : 'inline-block'}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right">
          <Card className="p-2 shadow-2xl">
            <div className="space-y-1">
              {/* User Info Header */}
              <div className="border-b border-surface px-3 py-3">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {user.email}
                </div>
                <div className="text-xs text-[var(--text-muted)] capitalize">
                  {user.role} account
                </div>
              </div>

              {/* Quick Actions */}
              <div className="px-1">
                <div className="space-y-1">
                  {/* Profile */}
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-muted"
                  >
                    <span className="text-[var(--brand)] text-sm">⚙️</span>
                    <span>Profile Settings</span>
                  </Link>

                  {/* Orders */}
                  <Link
                    href="/orders"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-muted"
                  >
                    <span className="text-[var(--brand)] text-sm">📦</span>
                    <span>My Orders</span>
                  </Link>

                  {/* Wishlist */}
                  <Link
                    href="/wishlist"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-muted"
                  >
                    <span className="text-[var(--danger-100)] text-sm">❤️</span>
                    <span>Wishlist</span>
                    {itemCount > 0 && (
                      <span className="ml-auto rounded-full bg-[var(--danger-10)] px-2 py-0.5 text-xs text-[var(--danger-100)]">
                        ♥
                      </span>
                    )}
                  </Link>

                  {/* Divider */}
                  <hr className="border-surface my-2" />

                  {/* Cart Link */}
                  <Link
                    href="/cart"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-muted"
                  >
                    <span className="text-[var(--accent)] text-sm">🛒</span>
                    <span>Shopping Cart</span>
                    {itemCount > 0 && (
                      <span className="ml-auto rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs text-[var(--accent)]/90">
                        {itemCount}
                      </span>
                    )}
                  </Link>

                  {/* Checkout Button */}
                  {itemCount > 0 && (
                    <Button
                        onClick={startCheckout}
                        disabled={Boolean(pending.checkout)}
                        className="w-full justify-center text-sm bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--brand-dark)] hover:from-[color:var(--brand-dark)] hover:to-[color:var(--brand)]"
                        size="sm"
                      >
                        {pending.checkout ? 'Preparing...' : 'Checkout'} ({itemCount})
                      </Button>
                  )}
                </div>
              </div>

              {/* Divider */}
              <hr className="border-surface my-2" />

              {/* Logout */}
              <div className="px-1">
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full justify-start px-3 py-2.5 text-sm font-medium text-[var(--danger-100)] hover:bg-[var(--danger-10)] hover:text-[var(--danger-100)]"
                >
                  <span className="mr-3 text-base">🚪</span>
                  Sign Out
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
