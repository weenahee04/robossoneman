import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const pointsRoutes = new Hono<AppEnv>();
pointsRoutes.use('*', requireAuth);

// Get points balance
pointsRoutes.get('/balance', async (c) => {
  const userId = c.get('userId');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalPoints: true, tier: true },
  });

  if (!user) return c.json({ message: 'User not found' }, 404);

  return c.json({
    data: { balance: user.totalPoints, tier: user.tier },
  });
});

// Get points history
pointsRoutes.get('/history', async (c) => {
  const userId = c.get('userId');
  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 20);

  const [transactions, total] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pointsTransaction.count({ where: { userId } }),
  ]);

  return c.json({ data: transactions, total, page, limit });
});

// Redeem points
pointsRoutes.post('/redeem', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { amount, rewardId } = z
    .object({ amount: z.number().positive(), rewardId: z.string() })
    .parse(body);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return c.json({ message: 'User not found' }, 404);

  if (user.totalPoints < amount) {
    return c.json({ message: 'Insufficient points' }, 400);
  }

  const [transaction] = await prisma.$transaction([
    prisma.pointsTransaction.create({
      data: {
        userId,
        type: 'redeem',
        amount: -amount,
        description: `Redeemed ${amount} points for reward ${rewardId}`,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { decrement: amount } },
    }),
  ]);

  return c.json({ data: transaction });
});
