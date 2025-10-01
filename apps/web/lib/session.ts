export function getSessionId(): string {
  let sid = typeof window !== 'undefined' ? window.localStorage.getItem('sid') : null;
  if (!sid) {
    sid = Math.random().toString(36).slice(2);
    if (typeof window !== 'undefined') window.localStorage.setItem('sid', sid);
  }
  return sid;
}
