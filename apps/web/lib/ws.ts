import { io, Socket } from 'socket.io-client';
import { getSessionId } from './session';

let socket: Socket | null = null;

function resolveSocketUrl(): string | undefined {
  // Prefer explicit env var set at build/runtime
  try {
    const envUrl = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_WS_URL as string | undefined) : undefined;
    if (envUrl) return envUrl.replace(/\/+$/, '');
  } catch (err) {
    // ignore
  }

  // If running in the browser, use same-origin. This keeps socket traffic on the
  // same host as the frontend by default which works well with proxies and docker.
  if (typeof window !== 'undefined' && window.location) {
    // If the app is served from a different origin than the API that exposes
    // the socket server, consumers should set NEXT_PUBLIC_WS_URL explicitly.
    return `${window.location.origin}`;
  }

  // Last resort: undefined (socket.io-client will attempt same-origin when url omitted)
  return undefined;
}

export function getSocket(): Socket {
  const url = resolveSocketUrl();
  if (!socket) {
    // If url is undefined, io() will connect to same origin.
    socket = io(url || undefined, {
      path: '/socket.io',
      auth: { sessionId: getSessionId() },
      autoConnect: true,
      // avoid excessive logs in prod
      transports: ['websocket', 'polling'],
    });
  } else {
    // update auth on subsequent calls
    socket.auth = { ...(socket.auth || {}), sessionId: getSessionId() };
  }
  return socket;
}

export function identifyUser(userId: string | null) {
  const s = getSocket();
  if (userId) {
    s.emit('user:identify', { userId });
  } else {
    // emit a null identify to clear server-side association
    s.emit('user:identify', { userId: null });
  }
}

export function identifySession(sessionId: string) {
  const s = getSocket();
  s.emit('session:identify', { sessionId });
}
