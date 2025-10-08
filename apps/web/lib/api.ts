import { authHeaders } from './auth';
import { getSessionId } from './session';

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;

function resolveApiBase(): string {
  // Prefer an explicit NEXT_PUBLIC_API_BASE when provided. Otherwise use a
  // same-origin proxy under '/api' which works in most deployments.
  if (configuredApiBase && typeof configuredApiBase === 'string' && configuredApiBase.length) {
    // normalize trailing slash
    return configuredApiBase.endsWith('/') ? configuredApiBase.slice(0, -1) : configuredApiBase;
  }
  return '/api';
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
