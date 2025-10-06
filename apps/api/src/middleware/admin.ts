import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

const RoleSchema = z.enum(['customer', 'admin']);

// Admin-only middleware
export const requireAdmin = async (req: any, res: Response, next: NextFunction) => {
  try {
    // First check if user is authenticated
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
};

// Combined auth + admin check
export const requireAuth = (req: any, res: Response, next: NextFunction) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  next();
};

export const requireAuthOrAdmin = (req: any, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => requireAdmin(req, res, next));
};
