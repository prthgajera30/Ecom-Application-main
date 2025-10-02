'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { getSessionId, clearSessionId } from '../lib/session';
import { identifyUser } from '../lib/ws';
import { getToken as getStoredToken, setToken as storeToken, clearToken as clearStored } from '../lib/auth';

type User = { id: string; email: string; role: 'customer' | 'admin' } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User>(null);

  const refresh = useCallback(async () => {
    const t = getStoredToken();
    setToken(t);
    if (!t) { setUser(null); identifyUser(null); return; }
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) { setUser(null); identifyUser(null); return; }
    const u = await res.json();
    setUser(u);
    identifyUser(u?.id ?? null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': getSessionId() },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const clone = res.clone();
      let message = 'We couldn\u2019t sign you in. Please try again.';
      try {
        const data = await res.json();
        const errorCode = typeof data?.error === 'string' ? data.error : undefined;
        if (typeof data?.message === 'string') {
          message = data.message;
        } else if (errorCode === 'INVALID_CREDENTIALS') {
          message = 'We couldn\u2019t match that email and password. Double-check your details and try again.';
        } else if (errorCode === 'VALIDATION') {
          message = 'Enter a valid email address and a password that meets the minimum length.';
        }
      } catch (_) {
        try {
          const textBody = (await clone.text()).trim();
          if (textBody) message = textBody;
        } catch (_) {}
      }
      throw new Error(message);
    }
    const data = await res.json();
    storeToken(data.token);
    await refresh();
  }, [refresh]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': getSessionId() },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const clone = res.clone();
      let message = 'We couldn\u2019t create your account right now. Please try again.';
      try {
        const data = await res.json();
        const errorCode = typeof data?.error === 'string' ? data.error : undefined;
        if (typeof data?.message === 'string') {
          message = data.message;
        } else if (errorCode === 'EMAIL_EXISTS') {
          message = 'Looks like an account already exists for that email. Try signing in instead.';
        } else if (errorCode === 'VALIDATION') {
          message = 'Use a valid email address and choose a password with at least 6 characters.';
        }
      } catch (_) {
        try {
          const textBody = (await clone.text()).trim();
          if (textBody) message = textBody;
        } catch (_) {}
      }
      throw new Error(message);
    }
    const data = await res.json();
    storeToken(data.token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    clearStored();
    clearSessionId();
    setToken(null);
    setUser(null);
    identifyUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

