import { Router } from 'express';
import { Session } from '../db';

const router = Router();

function isTestAuthorized(req: any) {
  // Allow when NODE_ENV is test, or when a valid test secret header is provided.
  if (process.env.NODE_ENV === 'test') return true;
  const secret = process.env.TEST_SECRET || '';
  const header = (req.headers['x-test-secret'] as string) || '';
  return secret && header && secret === header;
}

// Clear the session document or its cart for the given sessionId (default: 'anon')
router.post('/test/clear-session', async (req: any, res) => {
  if (!isTestAuthorized(req)) return res.status(403).json({ error: 'FORBIDDEN' });
  try {
    const sessionId = (req.body && req.body.sessionId) || (req.headers['x-session-id'] as string) || 'anon';
    // If session exists, remove cart items
    const session = await Session.findOne({ sessionId });
    if (session) {
      session.cart = { items: [] };
      session.updatedAt = new Date();
      await session.save();
    }
    // Also remove any orphaned session document if requested
    if (req.body && req.body.delete === true) {
      await Session.deleteOne({ sessionId });
    }
    return res.json({ ok: true, sessionId });
  } catch (err) {
    console.error('Failed to clear session in test route', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

export default router;
