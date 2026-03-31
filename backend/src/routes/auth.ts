import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const authRoutes = new Hono<AppEnv>();

const lineLoginSchema = z.object({
  accessToken: z.string().min(1),
});

// LINE Login — exchange LINE access token for app JWT
authRoutes.post('/line', async (c) => {
  const body = await c.req.json();
  const { accessToken } = lineLoginSchema.parse(body);

  // Verify LINE access token and get profile
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    return c.json({ message: 'Invalid LINE access token' }, 401);
  }

  const profile = (await profileRes.json()) as {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  };

  // Upsert user
  let user = await prisma.user.findUnique({
    where: { lineUserId: profile.userId },
  });

  if (!user) {
    const referralCode = `ROBOSS${Date.now().toString(36).toUpperCase()}`;
    user = await prisma.user.create({
      data: {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        avatarUrl: profile.pictureUrl || null,
        referralCode,
      },
    });

    // Create initial stamp card
    await prisma.stamp.create({
      data: { userId: user.id, targetCount: 10 },
    });

    // Create piggy bank
    await prisma.piggyBank.create({
      data: { userId: user.id },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: profile.displayName,
        avatarUrl: profile.pictureUrl || user.avatarUrl,
      },
    });
  }

  const tokens = {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
  };

  return c.json({
    data: {
      user: {
        id: user.id,
        lineUserId: user.lineUserId,
        displayName: user.displayName,
        pictureUrl: user.avatarUrl,
        tier: user.tier,
        totalPoints: user.totalPoints,
        totalWashes: user.totalWashes,
        memberSince: user.createdAt.toISOString(),
        createdAt: user.createdAt.toISOString(),
      },
      tokens,
    },
  });
});

// Dev login (only in development)
authRoutes.post('/dev-login', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return c.json({ message: 'Not available in production' }, 403);
  }

  const body = await c.req.json();
  const lineUserId = body.lineUserId || 'dev_user_001';

  let user = await prisma.user.findUnique({
    where: { lineUserId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        lineUserId,
        displayName: 'Dev User',
        avatarUrl: null,
        referralCode: `DEV${Date.now().toString(36).toUpperCase()}`,
        tier: 'gold',
        totalPoints: 1250,
        totalWashes: 14,
      },
    });

    await prisma.stamp.create({ data: { userId: user.id, targetCount: 10 } });
    await prisma.piggyBank.create({ data: { userId: user.id } });
  }

  const tokens = {
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
  };

  return c.json({
    data: {
      user: {
        id: user.id,
        lineUserId: user.lineUserId,
        displayName: user.displayName,
        pictureUrl: user.avatarUrl,
        tier: user.tier,
        totalPoints: user.totalPoints,
        totalWashes: user.totalWashes,
        memberSince: user.createdAt.toISOString(),
        createdAt: user.createdAt.toISOString(),
      },
      tokens,
    },
  });
});

// Refresh token
authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json();
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(body);

  try {
    const payload = verifyRefreshToken(refreshToken);
    const newAccessToken = signAccessToken(payload.userId);
    return c.json({ data: { accessToken: newAccessToken } });
  } catch {
    return c.json({ message: 'Invalid refresh token' }, 401);
  }
});

// Get current user
authRoutes.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return c.json({ message: 'User not found' }, 404);
  }

  return c.json({
    data: {
      id: user.id,
      lineUserId: user.lineUserId,
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

// Logout (client-side token removal; server can blacklist if needed)
authRoutes.post('/logout', requireAuth, async (c) => {
  return c.json({ data: { message: 'Logged out successfully' } });
});
