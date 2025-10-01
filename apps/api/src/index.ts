import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { connectMongo } from './db';
import authRoutes from './routes/auth';
import catalogRoutes from './routes/catalog';
import cartRoutes from './routes/cart';
import checkoutRoutes from './routes/checkout';
import ordersRoutes from './routes/orders';
import recsRoutes from './routes/recs';
import { fileURLToPath } from 'url';

export const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  path: '/socket.io',
  cors: { origin: '*' }
});
(app as any).set('io', io);

const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });
app.use(pinoHttp({ logger: logger as any }));
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ type: ['application/json','application/*+json'] }));

const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });
app.use('/api/auth', authLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', cartRoutes);
app.use('/api', checkoutRoutes);
app.use('/api', ordersRoutes);
app.use('/api', recsRoutes);

io.on('connection', (socket) => {
  logger.info({ id: socket.id }, 'socket connected');
  socket.join('inventory');
  const sessionId = socket.handshake.auth?.sessionId as string | undefined;
  const userId = socket.handshake.auth?.userId as string | undefined;
  if (sessionId) socket.join(`session:${sessionId}`);
  if (userId) socket.join(`user:${userId}`);
  socket.on('user:identify', (payload: { userId?: string }) => {
    if (payload?.userId) socket.join(`user:${payload.userId}`);
  });
  socket.on('session:identify', (payload: { sessionId?: string }) => {
    if (payload?.sessionId) socket.join(`session:${payload.sessionId}`);
  });
  socket.on('disconnect', () => logger.info({ id: socket.id }, 'socket disconnected'));
});

export async function start() {
  const PORT = process.env.PORT || 4000;
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/shop';
  await connectMongo(mongoUrl);
  return new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      logger.info(`API listening on ${PORT}`);
      resolve();
    });
  });
}

const isMain = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    return process.argv[1] && thisFile === process.argv[1];
  } catch {
    return false;
  }
})();

if (isMain) {
  start().catch((e) => {
    logger.error(e);
    process.exit(1);
  });
}
