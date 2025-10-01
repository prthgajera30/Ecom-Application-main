'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
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
    const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    storeToken(data.token);
    await refresh();
  }, [refresh]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error('Register failed');
    const data = await res.json();
    storeToken(data.token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    clearStored();
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
