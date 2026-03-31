import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const couponRoutes = new Hono<AppEnv>();
couponRoutes.use('*', requireAuth);

// Get user's coupons (optional ?branchId= filter)
couponRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const branchId = c.req.query('branchId');

  const userCoupons = await prisma.userCoupon.findMany({
    where: { userId },
    include: { coupon: true },
    orderBy: { coupon: { validUntil: 'desc' } },
  });

  let filtered = userCoupons;
  if (branchId) {
    filtered = userCoupons.filter((uc) => {
      const ids = uc.coupon.branchIds;
      return ids.length === 0 || ids.includes(branchId);
    });
  }

  return c.json({
    data: filtered.map((uc) => ({
      id: uc.id,
      userId: uc.userId,
      couponId: uc.couponId,
      isUsed: uc.isUsed,
      usedAt: uc.usedAt?.toISOString() || null,
      coupon: {
        id: uc.coupon.id,
        code: uc.coupon.code,
        title: uc.coupon.title,
        description: uc.coupon.description,
        discountType: uc.coupon.discountType,
        discountValue: uc.coupon.discountValue,
        minSpend: uc.coupon.minSpend,
        branchIds: uc.coupon.branchIds,
        validFrom: uc.coupon.validFrom.toISOString(),
        validUntil: uc.coupon.validUntil.toISOString(),
      },
    })),
  });
});

// Claim a coupon by code
couponRoutes.post('/claim', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { code } = z.object({ code: z.string().min(1) }).parse(body);

  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon) {
    return c.json({ message: 'Invalid coupon code' }, 404);
  }

  if (new Date() > coupon.validUntil) {
    return c.json({ message: 'Coupon has expired' }, 400);
  }

  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return c.json({ message: 'Coupon usage limit reached' }, 400);
  }

  const existing = await prisma.userCoupon.findUnique({
    where: { userId_couponId: { userId, couponId: coupon.id } },
  });

  if (existing) {
    return c.json({ message: 'Coupon already claimed' }, 400);
  }

  const userCoupon = await prisma.userCoupon.create({
    data: { userId, couponId: coupon.id },
    include: { coupon: true },
  });

  return c.json({ data: userCoupon }, 201);
});

// Use a coupon
couponRoutes.post('/:id/use', async (c) => {
  const userId = c.get('userId');
  const couponId = c.req.param('id');
  const body = await c.req.json();
  const { sessionId } = z.object({ sessionId: z.string() }).parse(body);

  const userCoupon = await prisma.userCoupon.findFirst({
    where: { id: couponId, userId, isUsed: false },
    include: { coupon: true },
  });

  if (!userCoupon) {
    return c.json({ message: 'Coupon not found or already used' }, 400);
  }

  const [updated] = await prisma.$transaction([
    prisma.userCoupon.update({
      where: { id: userCoupon.id },
      data: { isUsed: true, usedAt: new Date() },
      include: { coupon: true },
    }),
    prisma.coupon.update({
      where: { id: userCoupon.couponId },
      data: { usedCount: { increment: 1 } },
    }),
  ]);

  return c.json({ data: updated });
});
