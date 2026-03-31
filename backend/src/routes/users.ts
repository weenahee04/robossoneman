import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const userRoutes = new Hono<AppEnv>();

userRoutes.use('*', requireAuth);

const updateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

userRoutes.patch('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const data = updateProfileSchema.parse(body);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.displayName && { displayName: data.displayName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
    },
  });

  return c.json({
    data: {
      id: user.id,
      displayName: user.displayName,
      pictureUrl: user.avatarUrl,
      phone: user.phone,
      tier: user.tier,
      totalPoints: user.totalPoints,
      totalWashes: user.totalWashes,
      memberSince: user.createdAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
    },
  });
});

userRoutes.get('/me/stats', async (c) => {
  const userId = c.get('userId');

  const [user, sessionCount, totalSpent] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.washSession.count({
      where: { userId, washStatus: 'completed' },
    }),
    prisma.washSession.aggregate({
      where: { userId, paymentStatus: 'paid' },
      _sum: { totalPrice: true },
    }),
  ]);

  return c.json({
    data: {
      totalWashes: sessionCount,
      totalSpent: totalSpent._sum.totalPrice || 0,
      totalPoints: user?.totalPoints || 0,
      tier: user?.tier || 'bronze',
    },
  });
});
