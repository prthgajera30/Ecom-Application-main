'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getSessionId } from '../lib/session';
import { useEffect } from 'react';
import { getSocket, identifySession } from '../lib/ws';

const navLinks = [
  { href: '/products', label: 'Products' },
  { href: '/cart', label: 'Cart' },
  { href: '/orders', label: 'Orders' },
];

export default function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const sessionId = getSessionId();
    identifySession(sessionId);
    const socket = getSocket();
    if (user?.id) {
      socket.emit('user:identify', { userId: user.id });
    }
  }, [user?.id]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-8">
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
              className={`transition ${pathname === link.href ? 'text-white' : 'text-indigo-100/70 hover:text-white'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {!user ? (
            <div className="flex items-center gap-3">
              <Link href="/login" className="btn-secondary hidden sm:inline-flex">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Create account
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-medium text-indigo-100/80 sm:inline">{user.email}</span>
              <button className="btn-secondary" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
