import { io, Socket } from 'socket.io-client';
import { getSessionId } from './session';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('http://127.0.0.1:4000', {
      path: '/socket.io',
      auth: { sessionId: getSessionId() },
    });
  } else {
    socket.auth = { ...(socket.auth || {}), sessionId: getSessionId() };
  }
  return socket;
}

export function identifyUser(userId: string | null) {
  const s = getSocket();
  if (userId) {
    s.emit('user:identify', { userId });
  }
}

export function identifySession(sessionId: string) {
  const s = getSocket();
  s.emit('session:identify', { sessionId });
}
