import { authHeaders } from './auth';
import { getSessionId } from './session';

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);       

function resolveApiBase(): string {
  if (typeof window === 'undefined') {
    return configuredApiBase || '/api';
  }

  if (!configuredApiBase) return '/api';

  try {
    const url = new URL(configuredApiBase, window.location.origin);

    const configuredIsLocal = LOCAL_HOSTNAMES.has(url.hostname);
    const currentIsLocal = LOCAL_HOSTNAMES.has(window.location.hostname);

    if (configuredIsLocal && !currentIsLocal) {
      return '/api';
    }

    if (url.origin === window.location.origin) {
      return url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname || '/api'; 
    }

    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Invalid NEXT_PUBLIC_API_BASE, falling back to /api', error);
    }
    return '/api';
  }
}

function withApiBase(path: string): string {
  const base = resolveApiBase();
  return `${base}${path}`;
}

export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function buildHeaders(extra: Record<string, string> = {}) {
  return {
    'x-session-id': getSessionId(),
    ...authHeaders(),
    ...extra,
  } as Record<string, string>;
}

async function handleError(res: Response) {
  let parsed: any = null;
  let text = '';
  try {
    text = await res.text();
    parsed = text ? JSON.parse(text) : null;
  } catch (err) {
    parsed = null;
  }
  const message =
    parsed?.message || parsed?.error || text || `Request failed with status ${res.status}`;
  throw new ApiError(message, res.status, parsed);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(withApiBase(path), {
    cache: 'no-store',
    headers: buildHeaders(),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(withApiBase(path), {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const res = await fetch(withApiBase(path), {
    method: 'PATCH',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T | void> {
  const res = await fetch(withApiBase(path), {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!res.ok) await handleError(res);
  // DELETE endpoints might not return JSON
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}
