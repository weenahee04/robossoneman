import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getStampRewardValidUntil, STAMP_TARGET_COUNT } from '../services/stamp-rules.js';
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
      data: { userId, targetCount: STAMP_TARGET_COUNT },
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

// Get auditable stamp earning history
stampRoutes.get('/history', async (c) => {
  const userId = c.get('userId');
  const limitParam = Number.parseInt(c.req.query('limit') ?? '50', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

  const transactions = await prisma.stampTransaction.findMany({
    where: { userId },
    include: {
      stamp: {
        select: {
          id: true,
          currentCount: true,
          targetCount: true,
          rewardClaimed: true,
        },
      },
      session: {
        select: {
          id: true,
          subtotalPrice: true,
          discountAmount: true,
          totalPrice: true,
          completedAt: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          shortName: true,
        },
      },
      package: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return c.json({
    data: transactions.map((transaction) => ({
      id: transaction.id,
      stampId: transaction.stampId,
      sessionId: transaction.sessionId,
      branchId: transaction.branchId,
      packageId: transaction.packageId,
      stampCount: transaction.stampCount,
      rawStampCount: transaction.rawStampCount,
      reason: transaction.reason,
      metadata: transaction.metadata,
      voidedAt: transaction.voidedAt?.toISOString() || null,
      createdAt: transaction.createdAt.toISOString(),
      stamp: transaction.stamp,
      session: {
        ...transaction.session,
        completedAt: transaction.session.completedAt?.toISOString() || null,
      },
      branch: transaction.branch,
      package: transaction.package,
    })),
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

  const now = new Date();
  const couponCode = `STAMP-${Date.now().toString(36).toUpperCase()}-${stamp.id.slice(0, 6).toUpperCase()}`;

  let result: {
    coupon: {
      code: string;
      title: string;
      validUntil: Date;
    };
    userCoupon: {
      id: string;
      couponId: string;
    };
    nextStamp: {
      id: string;
      userId: string;
      currentCount: number;
      targetCount: number;
      rewardClaimed: boolean;
      lastStampAt: Date | null;
    };
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.stamp.updateMany({
        where: {
          id: stamp.id,
          userId,
          rewardClaimed: false,
          currentCount: { gte: stamp.targetCount },
        },
        data: { rewardClaimed: true },
      });

      if (claimed.count === 0) {
        throw new Error('Stamp reward is already claimed');
      }

      const coupon = await tx.coupon.create({
        data: {
          code: couponCode,
          title: 'ล้างรถฟรี 1 ครั้ง',
          description: 'รางวัลจาก Stamp Coupon: สะสมครบ 10 แสตมป์ รับฟรี 1 ครั้ง',
          scope: 'all_branches',
          status: 'active',
          discountType: 'percent',
          discountValue: 100,
          minSpend: 0,
          maxUses: 1,
          maxUsesPerUser: 1,
          packageIds: [],
          validFrom: now,
          validUntil: getStampRewardValidUntil(now),
        },
      });

      const userCoupon = await tx.userCoupon.create({
        data: { userId, couponId: coupon.id },
        include: { coupon: true },
      });

      const nextStamp = await tx.stamp.create({
        data: { userId, targetCount: STAMP_TARGET_COUNT },
      });

      return { coupon, userCoupon, nextStamp };
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Stamp reward is already claimed') {
      return c.json({ message: error.message }, 409);
    }
    throw error;
  }

  return c.json({
    data: {
      message: 'Reward claimed! Free wash coupon issued and a new stamp card started.',
      stamp: {
        id: result.nextStamp.id,
        userId: result.nextStamp.userId,
        currentCount: result.nextStamp.currentCount,
        targetCount: result.nextStamp.targetCount,
        rewardClaimed: result.nextStamp.rewardClaimed,
        lastStampAt: result.nextStamp.lastStampAt?.toISOString() || null,
      },
      rewardCoupon: {
        id: result.userCoupon.id,
        couponId: result.userCoupon.couponId,
        code: result.coupon.code,
        title: result.coupon.title,
        validUntil: result.coupon.validUntil.toISOString(),
      },
    },
  });
});
