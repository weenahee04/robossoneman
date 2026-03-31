import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const referralRoutes = new Hono<AppEnv>();
referralRoutes.use('*', requireAuth);

const REFERRAL_BONUS = 200; // points per referral

// Get referral info
referralRoutes.get('/', async (c) => {
  const userId = c.get('userId');

  const [user, referrals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referred: { select: { displayName: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalPointsEarned = referrals.reduce((sum, r) => sum + r.pointsEarned, 0);

  return c.json({
    data: {
      code: user?.referralCode || '',
      count: referrals.length,
      pointsEarned: totalPointsEarned,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredName: r.referred.displayName,
        pointsEarned: r.pointsEarned,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  });
});

// Apply referral code (called during registration)
referralRoutes.post('/apply', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { code } = z.object({ code: z.string().min(1) }).parse(body);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return c.json({ message: 'User not found' }, 404);
  if (user.referredBy) return c.json({ message: 'Already used a referral code' }, 400);

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
  });

  if (!referrer) return c.json({ message: 'Invalid referral code' }, 404);
  if (referrer.id === userId) return c.json({ message: 'Cannot refer yourself' }, 400);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { referredBy: referrer.id },
    }),
    prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: userId,
        pointsEarned: REFERRAL_BONUS,
      },
    }),
    prisma.pointsTransaction.create({
      data: {
        userId: referrer.id,
        type: 'bonus',
        amount: REFERRAL_BONUS,
        description: `Referral bonus — ${user.displayName} joined`,
      },
    }),
    prisma.user.update({
      where: { id: referrer.id },
      data: { totalPoints: { increment: REFERRAL_BONUS } },
    }),
  ]);

  return c.json({ data: { message: 'Referral applied successfully' } });
});
