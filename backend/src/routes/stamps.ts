import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const stampRoutes = new Hono<AppEnv>();
stampRoutes.use('*', requireAuth);

// Get current stamp card
stampRoutes.get('/', async (c) => {
  const userId = c.get('userId');

  let stamp = await prisma.stamp.findFirst({
    where: { userId, rewardClaimed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!stamp) {
    stamp = await prisma.stamp.create({
      data: { userId, targetCount: 10 },
    });
  }

  return c.json({
    data: {
      id: stamp.id,
      userId: stamp.userId,
      currentCount: stamp.currentCount,
      targetCount: stamp.targetCount,
      rewardClaimed: stamp.rewardClaimed,
      lastStampAt: stamp.lastStampAt?.toISOString() || null,
    },
  });
});

// Claim stamp reward
stampRoutes.post('/claim-reward', async (c) => {
  const userId = c.get('userId');

  const stamp = await prisma.stamp.findFirst({
    where: { userId, rewardClaimed: false },
  });

  if (!stamp || stamp.currentCount < stamp.targetCount) {
    return c.json({ message: 'Not enough stamps to claim reward' }, 400);
  }

  const REWARD_POINTS = 500;

  await prisma.$transaction([
    prisma.stamp.update({
      where: { id: stamp.id },
      data: { rewardClaimed: true },
    }),
    prisma.pointsTransaction.create({
      data: {
        userId,
        type: 'bonus',
        amount: REWARD_POINTS,
        description: 'Stamp card reward — free wash!',
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: REWARD_POINTS } },
    }),
    // Create new stamp card
    prisma.stamp.create({
      data: { userId, targetCount: 10 },
    }),
  ]);

  return c.json({
    data: { message: 'Reward claimed! New stamp card started.', pointsAwarded: REWARD_POINTS },
  });
});
