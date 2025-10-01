"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

const DEFAULT_DURATION = 4500;

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function createId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeoutId = timers.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timers.current.delete(id);
    }
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
    timers.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timers.current.clear();
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'> & { id?: string }) => {
      const id = toast.id || createId();
      setToasts((current) => {
        const next = current.filter((item) => item.id !== id);
        next.push({ id, variant: toast.variant || 'info', ...toast });
        return next;
      });
      const timeoutId = window.setTimeout(() => dismiss(id), toast.duration ?? DEFAULT_DURATION);
      timers.current.set(id, timeoutId);
      return id;
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(() => ({ toasts, push, dismiss, clear }), [toasts, push, dismiss, clear]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
