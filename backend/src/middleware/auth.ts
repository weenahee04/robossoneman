import { createMiddleware } from 'hono/factory';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { AppEnv } from '../lib/types.js';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized' }, 401);
  }

  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    c.set('userId', payload.userId);
    await next();
  } catch {
    return c.json({ message: 'Invalid or expired token' }, 401);
  }
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized' }, 401);
  }

  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);

    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.userId },
    });

    if (!admin || !admin.isActive) {
      return c.json({ message: 'Admin access required' }, 403);
    }

    c.set('adminId', admin.id);
    c.set('adminRole', admin.role);
    await next();
  } catch {
    return c.json({ message: 'Invalid or expired token' }, 401);
  }
});
