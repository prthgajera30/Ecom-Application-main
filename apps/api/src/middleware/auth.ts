import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export type AuthPayload = { userId: string; role: 'customer' | 'admin' };

export function signToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET || 'change_me';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const secret = process.env.JWT_SECRET || 'change_me';
    const decoded = jwt.verify(token, secret) as AuthPayload;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
}
