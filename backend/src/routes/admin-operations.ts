import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AppEnv } from '../lib/types.js';
import { requireAdmin } from '../middleware/auth.js';
import { contentInput, membershipPlanInput, pageQuery, pointsAdjustment } from '../lib/operations-input.js';

export const adminOperationsRoutes = new Hono<AppEnv>();
adminOperationsRoutes.use('*', requireAdmin);
adminOperationsRoutes.onError((error, c) => {
  if (error instanceof z.ZodError) return c.json({ message: error.issues.map(i => i.message).join('; ') }, 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return c.json({ message: 'รหัสหรือรายการนี้มีอยู่แล้ว กรุณาโหลดข้อมูลล่าสุด' }, 409);
    if (error.code === 'P2025') return c.json({ message: 'ไม่พบข้อมูล' }, 404);
    if (error.code === 'P2034') return c.json({ message: 'ข้อมูลเปลี่ยนระหว่างทำรายการ กรุณาลองใหม่' }, 409);
  }
  if (error.message === 'BRANCH_FORBIDDEN') return c.json({ message: 'ไม่มีสิทธิ์เข้าถึงสาขานี้' }, 403);
  if (error.message === 'BALANCE_CONFLICT') return c.json({ message: 'ยอดพ้อยท์เปลี่ยนหรือยอดไม่พอ กรุณาโหลดใหม่' }, 409);
  console.error('[admin-operations]', error);
  return c.json({ message: 'ไม่สามารถทำรายการได้ กรุณาลองใหม่' }, 500);
});

function branchScope(role: string, ids: string[], requested?: string) {
  if (requested && role !== 'hq_admin' && !ids.includes(requested)) throw new Error('BRANCH_FORBIDDEN');
  return requested ? { branchId: requested } : role === 'hq_admin' ? {} : { branchId: { in: ids } };
}
function userScope(role: string, ids: string[], requested?: string): Prisma.UserWhereInput {
  const scope = branchScope(role, ids, requested);
  return { deletedAt: null, ...(role === 'hq_admin' && !requested ? {} : { sessions: { some: scope } }) };
}

adminOperationsRoutes.get('/points', async c => {
  const { page, limit, search, branchId } = pageQuery.parse(c.req.query());
  const where: Prisma.UserWhereInput = { ...userScope(c.get('adminRole'), c.get('adminBranchIds'), branchId),
    ...(search ? { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) };
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, displayName: true, phone: true, tier: true, isActive: true, wallet: { select: { balance: true, lifetimeEarned: true, lifetimeRedeemed: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.user.count({ where }),
  ]);
  return c.json({ data, total, page, limit });
});

adminOperationsRoutes.get('/points/:userId/history', async c => {
  const { page, limit, branchId } = pageQuery.parse(c.req.query());
  const role = c.get('adminRole'), ids = c.get('adminBranchIds'), userId = c.req.param('userId');
  const user = await prisma.user.findFirst({ where: { id: userId, ...userScope(role, ids, branchId) }, select: { id: true } });
  if (!user) return c.json({ message: 'ไม่พบลูกค้าในขอบเขตสิทธิ์' }, 404);
  const where = { userId, ...branchScope(role, ids, branchId) };
  const [data, total] = await Promise.all([
    prisma.pointsTransaction.findMany({ where, select: { id: true, type: true, amount: true, balanceAfter: true, description: true, branchId: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.pointsTransaction.count({ where }),
  ]);
  return c.json({ data, total, page, limit });
});

adminOperationsRoutes.post('/points/:userId/adjust', async c => {
  if (c.get('adminRole') !== 'hq_admin') return c.json({ message: 'เฉพาะสำนักงานใหญ่เท่านั้นที่ปรับพ้อยท์ได้' }, 403);
  const input = pointsAdjustment.parse(await c.req.json()), userId = c.req.param('userId'), adminId = c.get('adminId');
  const previous = await prisma.pointsTransaction.findUnique({ where: { id: input.requestId } });
  if (previous) {
    const metadata = previous.metadata as Record<string, unknown> | null;
    if (previous.userId !== userId || previous.amount !== input.amount || previous.description !== input.reason || metadata?.adminId !== adminId) return c.json({ message: 'รหัสรายการซ้ำกับข้อมูลอื่น' }, 409);
    return c.json({ data: previous, replayed: true });
  }
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null, isActive: true }, select: { id: true } });
  if (!user) return c.json({ message: 'ไม่พบลูกค้าที่ใช้งานอยู่' }, 404);
  const transaction = await prisma.$transaction(async tx => {
    const wallet = await tx.pointWallet.upsert({ where: { userId }, create: { userId }, update: {} });
    const next = wallet.balance + input.amount;
    if (next < 0 || next > 2000000000) throw new Error('BALANCE_CONFLICT');
    const changed = await tx.pointWallet.updateMany({ where: { id: wallet.id, balance: wallet.balance }, data: { balance: next } });
    if (changed.count !== 1) throw new Error('BALANCE_CONFLICT');
    await tx.user.update({ where: { id: userId }, data: { totalPoints: next } });
    const data = await tx.pointsTransaction.create({ data: { id: input.requestId, userId, walletId: wallet.id, type: 'adjust', amount: input.amount, balanceAfter: next, description: input.reason, metadata: { adminId } } });
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: adminId, userId, action: 'admin.points.adjust', entityType: 'points_transaction', entityId: data.id, metadata: { amount: input.amount, reason: input.reason, balanceBefore: wallet.balance, balanceAfter: next } } });
    return data;
  }, { isolationLevel: 'Serializable' });
  return c.json({ data: transaction }, 201);
});

adminOperationsRoutes.get('/audit-logs', async c => {
  const { page, limit, search, branchId } = pageQuery.parse(c.req.query());
  const where: Prisma.AuditLogWhereInput = { ...branchScope(c.get('adminRole'), c.get('adminBranchIds'), branchId),
    ...(search ? { OR: [{ action: { contains: search, mode: 'insensitive' } }, { entityId: { contains: search } }] } : {}) };
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({ where, select: { id: true, action: true, actorType: true, entityType: true, entityId: true, createdAt: true, adminUser: { select: { name: true } }, branch: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.auditLog.count({ where }),
  ]);
  // Metadata is intentionally excluded: legacy entries can contain provider/config details.
  return c.json({ data, total, page, limit });
});

adminOperationsRoutes.get('/membership-plans', async c => {
  if (c.get('adminRole') !== 'hq_admin') return c.json({ message: 'เฉพาะสำนักงานใหญ่' }, 403);
  return c.json({ data: await prisma.membershipPlan.findMany({ include: { _count: { select: { memberships: true } } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }) });
});

adminOperationsRoutes.get('/reward-redemptions', async c => {
  const { page, limit, search, branchId } = pageQuery.parse(c.req.query());
  const where: Prisma.PointsTransactionWhereInput = { type: 'redeem', ...branchScope(c.get('adminRole'), c.get('adminBranchIds'), branchId), ...(search ? { user: { displayName: { contains: search, mode: 'insensitive' } } } : {}) };
  const [rows, total] = await Promise.all([
    prisma.pointsTransaction.findMany({ where, include: { user: { select: { displayName: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.pointsTransaction.count({ where }),
  ]);
  return c.json({ data: rows.map(row => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return { id: row.id, customerName: row.user.displayName, rewardName: typeof meta.rewardName === 'string' ? meta.rewardName : row.description, amount: row.amount, createdAt: row.createdAt, status: meta.fulfillmentStatus === 'fulfilled' ? 'fulfilled' : 'pending', fulfilledAt: typeof meta.fulfilledAt === 'string' ? meta.fulfilledAt : null };
  }), total, page, limit });
});
adminOperationsRoutes.post('/reward-redemptions/:id/fulfill', async c => {
  const input = z.object({ note: z.string().trim().min(3).max(500) }).strict().parse(await c.req.json());
  const id = c.req.param('id');
  const row = await prisma.pointsTransaction.findFirst({ where: { id, type: 'redeem', ...branchScope(c.get('adminRole'), c.get('adminBranchIds')) } });
  if (!row) return c.json({ message: 'ไม่พบรายการในขอบเขตสิทธิ์' }, 404);
  const metadata = (row.metadata ?? {}) as Prisma.JsonObject;
  if (metadata.fulfillmentStatus === 'fulfilled') return c.json({ data: { id, status: 'fulfilled' }, replayed: true });
  const updated = await prisma.$transaction(async tx => {
    const changed = await tx.pointsTransaction.updateMany({ where: { id, metadata: { equals: row.metadata ?? Prisma.DbNull } }, data: { metadata: { ...metadata, fulfillmentStatus: 'fulfilled', fulfilledAt: new Date().toISOString(), fulfilledBy: c.get('adminId'), fulfillmentNote: input.note } } });
    if (!changed.count) return false;
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: c.get('adminId'), userId: row.userId, branchId: row.branchId, action: 'admin.reward.fulfill', entityType: 'points_transaction', entityId: id, metadata: { note: input.note } } });
    return true;
  });
  if (!updated) return c.json({ message: 'รายการเปลี่ยนแล้ว กรุณาโหลดใหม่' }, 409);
  return c.json({ data: { id, status: 'fulfilled' } });
});
adminOperationsRoutes.post('/membership-plans', async c => {
  if (c.get('adminRole') !== 'hq_admin') return c.json({ message: 'เฉพาะสำนักงานใหญ่' }, 403);
  const input = membershipPlanInput.parse(await c.req.json());
  const data = await prisma.$transaction(async tx => {
    const plan = await tx.membershipPlan.create({ data: input as Prisma.MembershipPlanCreateInput });
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: c.get('adminId'), action: 'admin.membership_plan.create', entityType: 'membership_plan', entityId: plan.id } });
    return plan;
  });
  return c.json({ data }, 201);
});
adminOperationsRoutes.patch('/membership-plans/:id', async c => {
  if (c.get('adminRole') !== 'hq_admin') return c.json({ message: 'เฉพาะสำนักงานใหญ่' }, 403);
  // Plans with customers are immutable; create a new version instead of altering purchased rights.
  const input = z.object({ isActive: z.boolean() }).strict().parse(await c.req.json());
  const data = await prisma.$transaction(async tx => {
    const plan = await tx.membershipPlan.update({ where: { id: c.req.param('id') }, data: input });
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: c.get('adminId'), action: 'admin.membership_plan.activation', entityType: 'membership_plan', entityId: plan.id, metadata: input } });
    return plan;
  });
  return c.json({ data });
});

adminOperationsRoutes.get('/content', async c => {
  if (c.get('adminRole') !== 'hq_admin') return c.json({ message: 'เฉพาะสำนักงานใหญ่' }, 403);
  const { page, limit, search } = pageQuery.parse(c.req.query());
  const kind = z.enum(['faq', 'article']).optional().parse(c.req.query('kind'));
  const where = { ...(kind ? { kind } : {}), ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}) };
  const [data, total] = await Promise.all([prisma.appContent.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], take: limit, skip: (page - 1) * limit }), prisma.appContent.count({ where })]);
  return c.json({ data, total, page, limit });
});
adminOperationsRoutes.post('/content', async c => {
  if (c.get('adminRole') !== 'hq_admin') return c.json({ message: 'เฉพาะสำนักงานใหญ่' }, 403);
  const input = contentInput.parse(await c.req.json());
  const data = await prisma.$transaction(async tx => {
    const entry = await tx.appContent.create({ data: input as Prisma.AppContentCreateInput });
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: c.get('adminId'), action: 'admin.content.create', entityType: 'app_content', entityId: entry.id, metadata: { kind: entry.kind, published: entry.isPublished } } });
    return entry;
  });
  return c.json({ data }, 201);
});
adminOperationsRoutes.patch('/content/:id', async c => {
  if (c.get('adminRole') !== 'hq_admin') return c.json({ message: 'เฉพาะสำนักงานใหญ่' }, 403);
  const payload = await c.req.json();
  const version = z.number().int().positive().parse(payload.version);
  const { version: _version, ...rest } = payload;
  const input = contentInput.parse(rest);
  const data = await prisma.$transaction(async tx => {
    const updated = await tx.appContent.updateMany({ where: { id: c.req.param('id'), version }, data: { ...input, version: { increment: 1 } } });
    if (!updated.count) return null;
    const entry = await tx.appContent.findUniqueOrThrow({ where: { id: c.req.param('id') } });
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: c.get('adminId'), action: 'admin.content.update', entityType: 'app_content', entityId: entry.id, metadata: { kind: entry.kind, version: entry.version, published: entry.isPublished } } });
    return entry;
  });
  if (!data) return c.json({ message: 'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดล่าสุดก่อนบันทึก' }, 409);
  return c.json({ data });
});
