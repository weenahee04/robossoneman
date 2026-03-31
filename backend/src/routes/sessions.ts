import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const sessionRoutes = new Hono<AppEnv>();
sessionRoutes.use('*', requireAuth);

const POINTS_RATE = 10; // 1 THB = 10 points

const createSessionSchema = z.object({
  branchId: z.string().min(1),
  machineId: z.string().min(1),
  packageId: z.string().min(1),
  carSize: z.enum(['S', 'M', 'L']),
  addons: z.array(z.string()).default([]),
  totalPrice: z.number().positive(),
  couponId: z.string().min(1).optional(),
});

// Create wash session
sessionRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const data = createSessionSchema.parse(body);

  // Verify machine is available
  const machine = await prisma.machine.findUnique({
    where: { id: data.machineId },
  });

  if (!machine || machine.status !== 'idle') {
    return c.json({ message: 'Machine is not available' }, 400);
  }

  // Get package for step count
  const pkg = await prisma.washPackage.findUnique({
    where: { id: data.packageId },
  });

  if (!pkg) {
    return c.json({ message: 'Package not found' }, 404);
  }

  const steps = pkg.steps as string[];

  const session = await prisma.washSession.create({
    data: {
      userId,
      branchId: data.branchId,
      machineId: data.machineId,
      packageId: data.packageId,
      carSize: data.carSize,
      addons: data.addons,
      totalPrice: data.totalPrice,
      totalSteps: steps.length,
      couponId: data.couponId || null,
    },
  });

  return c.json({ data: session }, 201);
});

// Confirm payment for a session
sessionRoutes.post('/:id/confirm-payment', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');

  const session = await prisma.washSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    return c.json({ message: 'Session not found' }, 404);
  }

  if (session.paymentStatus !== 'pending') {
    return c.json({ message: 'Payment already processed' }, 400);
  }

  // Update session to paid and start washing
  const updated = await prisma.washSession.update({
    where: { id: sessionId },
    data: {
      paymentStatus: 'paid',
      washStatus: 'washing',
      startedAt: new Date(),
    },
  });

  // Mark machine as washing
  await prisma.machine.update({
    where: { id: session.machineId },
    data: { status: 'washing' },
  });

  return c.json({ data: updated });
});

// Update wash progress (called by IoT bridge or simulation)
sessionRoutes.patch('/:id/progress', async (c) => {
  const sessionId = c.req.param('id');
  const body = await c.req.json();
  const { currentStep, progress } = z
    .object({ currentStep: z.number(), progress: z.number() })
    .parse(body);

  const updated = await prisma.washSession.update({
    where: { id: sessionId },
    data: { currentStep, progress },
  });

  return c.json({ data: updated });
});

// Complete wash session
sessionRoutes.post('/:id/complete', async (c) => {
  const sessionId = c.req.param('id');

  const session = await prisma.washSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return c.json({ message: 'Session not found' }, 404);
  }

  const pointsEarned = session.totalPrice * POINTS_RATE;

  // Transaction: complete session + award points + update user + update machine + add stamp
  const [updated] = await prisma.$transaction([
    prisma.washSession.update({
      where: { id: sessionId },
      data: {
        washStatus: 'completed',
        progress: 100,
        currentStep: session.totalSteps,
        pointsEarned,
        completedAt: new Date(),
      },
    }),
    prisma.pointsTransaction.create({
      data: {
        userId: session.userId,
        sessionId,
        type: 'earn',
        amount: pointsEarned,
        description: `Wash completed — ${pointsEarned} points`,
      },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: {
        totalPoints: { increment: pointsEarned },
        totalWashes: { increment: 1 },
      },
    }),
    prisma.machine.update({
      where: { id: session.machineId },
      data: { status: 'idle' },
    }),
    prisma.stamp.updateMany({
      where: { userId: session.userId, rewardClaimed: false },
      data: {
        currentCount: { increment: 1 },
        lastStampAt: new Date(),
      },
    }),
  ]);

  // Update user tier based on total washes
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (user) {
    let newTier = user.tier;
    if (user.totalWashes >= 100) newTier = 'platinum';
    else if (user.totalWashes >= 50) newTier = 'gold';
    else if (user.totalWashes >= 20) newTier = 'silver';

    if (newTier !== user.tier) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tier: newTier },
      });
    }
  }

  return c.json({ data: updated });
});

// Rate session
sessionRoutes.post('/:id/rate', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const body = await c.req.json();
  const { rating, reviewText } = z
    .object({ rating: z.number().min(1).max(5), reviewText: z.string().optional() })
    .parse(body);

  const session = await prisma.washSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    return c.json({ message: 'Session not found' }, 404);
  }

  const updated = await prisma.washSession.update({
    where: { id: sessionId },
    data: { rating, reviewText },
  });

  return c.json({ data: updated });
});

// Get session by ID
sessionRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');

  const session = await prisma.washSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      branch: { select: { name: true } },
      package: { select: { name: true, steps: true } },
    },
  });

  if (!session) {
    return c.json({ message: 'Session not found' }, 404);
  }

  return c.json({ data: session });
});

// Get session history
sessionRoutes.get('/history', async (c) => {
  const userId = c.get('userId');
  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 20);

  const [sessions, total] = await Promise.all([
    prisma.washSession.findMany({
      where: { userId },
      include: {
        branch: { select: { name: true } },
        package: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.washSession.count({ where: { userId } }),
  ]);

  return c.json({ data: sessions, total, page, limit });
});
