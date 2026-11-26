import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';
import { randomUUID } from 'node:crypto';

export const pointsRoutes = new Hono<AppEnv>();
pointsRoutes.use('*', requireAuth);

// Get points balance
pointsRoutes.get('/balance', async (c) => {
  const userId = c.get('userId');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tier: true,
      wallet: {
        select: {
          balance: true,
          lifetimeEarned: true,
          lifetimeRedeemed: true,
        },
      },
    },
  });

  if (!user) return c.json({ message: 'User not found' }, 404);

  return c.json({
    data: {
      balance: user.wallet?.balance ?? 0,
      tier: user.tier,
      lifetimeEarned: user.wallet?.lifetimeEarned ?? 0,
      lifetimeRedeemed: user.wallet?.lifetimeRedeemed ?? 0,
    },
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

pointsRoutes.get('/rewards', async (c) => {
  const branchId = c.req.query('branchId');

  const rewards = await prisma.rewardCatalog.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const filtered = branchId
    ? rewards.filter((reward) => reward.branchIds.length === 0 || reward.branchIds.includes(branchId))
    : rewards;

  return c.json({
    data: filtered.map((reward) => ({
      id: reward.id,
      code: reward.code,
      name: reward.name,
      description: reward.description,
      points: reward.pointsCost,
      category: reward.category,
      tag: reward.tag,
      icon: reward.icon,
      iconBg: reward.iconBg,
      stock: reward.stock,
      branchIds: reward.branchIds,
    })),
  });
});

// Redeem points atomically: wallet, mirrored balance, stock and ledger agree.
pointsRoutes.post('/redeem', async (c) => {
  const userId = c.get('userId');
  const parsed = z.object({
    amount: z.number().int().positive().max(1000000),
    rewardId: z.string().min(1),
    branchId: z.string().min(1).optional(),
    requestId: z.string().uuid().optional(),
  }).strict().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: 'Invalid redemption request' }, 400);
  const { amount, rewardId, branchId } = parsed.data;
  const requestId = parsed.data.requestId ?? randomUUID();
  const existing = await prisma.pointsTransaction.findUnique({ where: { id: requestId } });
  if (existing) {
    const meta = existing.metadata as Record<string, unknown> | null;
    if (existing.userId !== userId || existing.type !== 'redeem' || existing.amount !== -amount || meta?.rewardId !== rewardId || existing.branchId !== (branchId ?? null)) return c.json({ message: 'Request ID conflict' }, 409);
    return c.json({ data: existing });
  }
  try {
    const transaction = await prisma.$transaction(async tx => {
      const [wallet, reward] = await Promise.all([
        tx.pointWallet.findUnique({ where: { userId } }),
        tx.rewardCatalog.findUnique({ where: { id: rewardId } }),
      ]);
      if (!wallet || !reward || !reward.isActive) throw new Error('REWARD_UNAVAILABLE');
      if (reward.pointsCost !== amount) throw new Error('PRICE_CHANGED');
      if (reward.branchIds.length && (!branchId || !reward.branchIds.includes(branchId))) throw new Error('BRANCH_UNAVAILABLE');
      if (branchId && !await tx.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true } })) throw new Error('BRANCH_UNAVAILABLE');
      if (wallet.balance < amount) throw new Error('INSUFFICIENT_POINTS');
      const changed = await tx.pointWallet.updateMany({ where: { id: wallet.id, balance: wallet.balance }, data: { balance: { decrement: amount }, lifetimeRedeemed: { increment: amount } } });
      if (changed.count !== 1) throw new Error('BALANCE_CONFLICT');
      if (reward.stock !== null) {
        const stock = await tx.rewardCatalog.updateMany({ where: { id: reward.id, isActive: true, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
        if (stock.count !== 1) throw new Error('OUT_OF_STOCK');
      }
      const balanceAfter = wallet.balance - amount;
      await tx.user.update({ where: { id: userId }, data: { totalPoints: balanceAfter } });
      return tx.pointsTransaction.create({ data: {
        id: requestId, walletId: wallet.id, userId, branchId, type: 'redeem', amount: -amount, balanceAfter,
        description: `Redeemed ${amount} points for reward ${reward.name}`,
        metadata: { rewardId: reward.id, rewardCode: reward.code, rewardName: reward.name, fulfillmentStatus: 'pending' },
      } });
    }, { isolationLevel: 'Serializable' });
    return c.json({ data: transaction });
  } catch (error) {
    const messages: Record<string, string> = {
      REWARD_UNAVAILABLE: 'ของรางวัลไม่พร้อมใช้งาน', PRICE_CHANGED: 'จำนวนพ้อยท์เปลี่ยน กรุณาโหลดใหม่',
      BRANCH_UNAVAILABLE: 'ของรางวัลใช้ไม่ได้กับสาขานี้', INSUFFICIENT_POINTS: 'พ้อยท์ไม่เพียงพอ',
      BALANCE_CONFLICT: 'ยอดเปลี่ยนระหว่างทำรายการ กรุณาลองใหม่', OUT_OF_STOCK: 'ของรางวัลหมดแล้ว',
    };
    const message = error instanceof Error ? messages[error.message] : undefined;
    if (message) return c.json({ message }, 409);
    if (error && typeof error === 'object' && 'code' in error && ['P2034', 'P2002'].includes(String(error.code))) return c.json({ message: 'รายการกำลังอัปเดต กรุณาลองใหม่ด้วยรหัสรายการเดิม' }, 409);
    throw error;
  }
});
