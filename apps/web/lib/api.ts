import { authHeaders } from './auth';
import { getSessionId } from './session';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

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
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: buildHeaders(),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}
