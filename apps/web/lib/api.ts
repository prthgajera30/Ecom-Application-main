import { authHeaders } from './auth';
import { getSessionId } from './session';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

function buildHeaders(extra: Record<string, string> = {}) {
  return {
    'x-session-id': getSessionId(),
    ...authHeaders(),
    ...extra,
  } as Record<string, string>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}
