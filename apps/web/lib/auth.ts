export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('token');
}

export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
