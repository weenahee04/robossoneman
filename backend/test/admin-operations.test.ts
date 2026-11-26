import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { canAccessAdminRoute } from '../src/lib/admin-access.js';
import { contentInput, membershipPlanInput, pageQuery, pointsAdjustment } from '../src/lib/operations-input.js';

// No test in this file is permitted to reach the configured customer database.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/roboss_test_unreachable';
const { prisma } = await import('../src/lib/prisma.js');
const { adminOperationsRoutes } = await import('../src/routes/admin-operations.js');
const { contentRoutes } = await import('../src/routes/content.js');
const { pointsRoutes } = await import('../src/routes/points.js');
const { membershipRoutes, adminMembershipRoutes } = await import('../src/routes/memberships.js');
const { signAdminAccessToken, signAccessToken } = await import('../src/lib/jwt.js');
const id = 'aa86d9c6-4cd5-4907-91c2-cf44a9e77f01';

function stub(t: any, object: any, key: string, implementation: (...args: any[]) => any) {
  const original = object[key];
  object[key] = t.mock.fn(implementation);
  t.after(() => { object[key] = original; });
}

function setup(t: any, role = 'hq_admin') {
  stub(t, prisma.adminUser, 'findUnique', async () => ({ id: 'admin-1', role, isActive: true, branchScopes: [{ branchId: 'branch-a' }] }));
  const app = new Hono();
  app.route('/api/admin', adminOperationsRoutes);
  app.route('/api/content', contentRoutes);
  app.route('/api/points', pointsRoutes);
  app.route('/api/memberships', membershipRoutes);
  app.route('/api/admin/membership-purchases', adminMembershipRoutes);
  const token = signAdminAccessToken('admin-1', role as any, ['branch-a']);
  return (path: string, method = 'GET', body?: unknown, auth = token) => app.request(`http://localhost${path}`, { method, headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test('cashier route policy is deny-by-default for writes and sensitive reads', () => {
  assert.equal(canAccessAdminRoute('cashier', 'GET', '/api/admin/branches'), false);
  assert.equal(canAccessAdminRoute('cashier', 'POST', '/api/admin/cashier/payments'), true);
  assert.equal(canAccessAdminRoute('cashier', 'GET', '/api/admin/meta'), true);
  assert.equal(canAccessAdminRoute('cashier', 'GET', '/api/admin/sessions'), true);
  for (const path of ['/api/admin/users', '/api/admin/revenue', '/api/admin/payment-configs', '/api/admin/points', '/api/admin/audit-logs', '/api/admin/content', '/api/admin/membership-purchases']) {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) assert.equal(canAccessAdminRoute('cashier', method, path), false, `${method} ${path}`);
  }
  assert.equal(canAccessAdminRoute('cashier', 'POST', '/api/admin/machines/1/command'), false);
  assert.equal(canAccessAdminRoute('unknown', 'GET', '/api/admin/meta'), false);
});
test('input validation bounds pagination and rejects unsafe adjustments/content', () => {
  for (const limit of ['-1', '0', '101', 'NaN']) assert.equal(pageQuery.safeParse({ limit }).success, false);
  assert.equal(pageQuery.parse({}).limit, 25);
  for (const amount of [0, 0.5, 1000001, -1000001]) assert.equal(pointsAdjustment.safeParse({ amount, reason: 'ปรับปรุงยอด', requestId: id }).success, false);
  assert.equal(contentInput.safeParse({ kind: 'faq', slug: 'help', title: 'คำถาม', body: 'คำตอบ', imageUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(contentInput.safeParse({ kind: 'faq', slug: 'help', title: 'คำถาม', body: 'คำตอบ' }).success, true);
  assert.equal(membershipPlanInput.safeParse({ code: 'AA', name: 'แพ็ก', price: 100, washLimit: 1, grapheneLimit: 2, durationMonths: 6, group: 'bundle', freeVacuumPerVisit: false, vipFastLane: false }).success, false);
});
test('customer token and cashier cannot call admin point routes', async t => {
  const request = setup(t, 'cashier');
  assert.equal((await request('/api/admin/points')).status, 403);
  assert.equal((await request('/api/admin/points', 'GET', undefined, signAccessToken('customer-1'))).status, 403);
  assert.equal((await request('/api/admin/points', 'GET', undefined, 'invalid')).status, 401);
});
test('branch admin cannot modify global points or plans or content', async t => {
  const request = setup(t, 'branch_admin');
  for (const path of ['/api/admin/points/user-1/adjust', '/api/admin/membership-plans', '/api/admin/content']) assert.equal((await request(path, 'POST', {})).status, 403);
});
test('branch scope rejects an out-of-scope branch before data access', async t => {
  const request = setup(t, 'branch_admin');
  assert.equal((await request('/api/admin/points?branchId=branch-b')).status, 403);
  assert.equal((await request('/api/admin/audit-logs?branchId=branch-b')).status, 403);
});
test('HQ point list includes newly registered customers without sessions', async t => {
  const request = setup(t);
  let captured: any;
  stub(t, prisma.user, 'findMany', async (args: any) => { captured = args; return [{ id: 'new', displayName: 'ลูกค้าใหม่', wallet: null }]; });
  stub(t, prisma.user, 'count', async () => 1);
  const result = await request('/api/admin/points');
  assert.equal(result.status, 200); assert.equal(captured.where.sessions, undefined); assert.equal(captured.where.deletedAt, null);
  assert.equal((await result.json()).total, 1);
});
test('branch list is restricted by a session relationship, not global user IDs', async t => {
  const request = setup(t, 'branch_admin');
  let captured: any;
  stub(t, prisma.user, 'findMany', async (args: any) => { captured = args; return []; });
  stub(t, prisma.user, 'count', async () => 0);
  assert.equal((await request('/api/admin/points')).status, 200);
  assert.deepEqual(captured.where.sessions.some.branchId, { in: ['branch-a'] });
});
test('point adjustment updates wallet, mirror and audit within one transaction callback', async t => {
  const request = setup(t); const calls: string[] = [];
  stub(t, prisma.pointsTransaction, 'findUnique', async () => null);
  stub(t, prisma.user, 'findFirst', async () => ({ id: 'user-1' }));
  stub(t, prisma, '$transaction', async (callback: any, options: any) => {
    assert.equal(options.isolationLevel, 'Serializable');
    return callback({ pointWallet: { upsert: async () => ({ id: 'wallet-1', balance: 100 }), updateMany: async (args: any) => { assert.equal(args.where.balance, 100); assert.equal(args.data.balance, 125); calls.push('wallet'); return { count: 1 }; } }, user: { update: async (args: any) => { assert.equal(args.data.totalPoints, 125); calls.push('user'); } }, pointsTransaction: { create: async ({ data }: any) => { calls.push('ledger'); return data; } }, auditLog: { create: async ({ data }: any) => { assert.equal(data.metadata.reason, 'ชดเชยบริการ'); calls.push('audit'); } } });
  });
  const response = await request('/api/admin/points/user-1/adjust', 'POST', { amount: 25, reason: 'ชดเชยบริการ', requestId: id });
  assert.equal(response.status, 201); assert.deepEqual(calls, ['wallet', 'user', 'ledger', 'audit']); assert.equal((await response.json()).data.balanceAfter, 125);
});
test('idempotent point retry returns original result and rejects mismatched reuse', async t => {
  const request = setup(t);
  stub(t, prisma.pointsTransaction, 'findUnique', async () => ({ id, userId: 'user-1', amount: 25, description: 'ชดเชยบริการ', metadata: { adminId: 'admin-1' }, balanceAfter: 125 }));
  const replay = await request('/api/admin/points/user-1/adjust', 'POST', { amount: 25, reason: 'ชดเชยบริการ', requestId: id });
  assert.equal(replay.status, 200); assert.equal((await replay.json()).replayed, true);
  assert.equal((await request('/api/admin/points/user-1/adjust', 'POST', { amount: 30, reason: 'ชดเชยบริการ', requestId: id })).status, 409);
});
test('insufficient balance cannot reach wallet mutation', async t => {
  const request = setup(t);
  stub(t, prisma.pointsTransaction, 'findUnique', async () => null);
  stub(t, prisma.user, 'findFirst', async () => ({ id: 'user-1' }));
  stub(t, prisma, '$transaction', async (callback: any) => callback({ pointWallet: { upsert: async () => ({ id: 'wallet-1', balance: 10 }), updateMany: async () => { assert.fail('must not update'); } } }));
  assert.equal((await request('/api/admin/points/user-1/adjust', 'POST', { amount: -20, reason: 'แก้ยอดผิดพลาด', requestId: id })).status, 409);
});
test('audit listing excludes sensitive metadata and respects branch scope', async t => {
  const request = setup(t, 'branch_admin'); let captured: any;
  stub(t, prisma.auditLog, 'findMany', async (args: any) => { captured = args; return []; });
  stub(t, prisma.auditLog, 'count', async () => 0);
  assert.equal((await request('/api/admin/audit-logs')).status, 200);
  assert.equal(captured.select.metadata, undefined); assert.deepEqual(captured.where.branchId, { in: ['branch-a'] });
});
test('content public API exposes only published items with bounded output', async t => {
  const request = setup(t); let captured: any;
  stub(t, prisma.appContent, 'findMany', async (args: any) => { captured = args; return []; });
  stub(t, prisma.appContent, 'count', async () => 2);
  const response = await request('/api/content/faq');
  assert.equal(response.status, 200); assert.deepEqual(captured.where, { kind: 'faq', isPublished: true }); assert.equal(captured.take, 100);
  assert.deepEqual(await response.json(), { data: [], configured: true });
  assert.equal((await request('/api/content/secrets')).status, 404);
});
test('content stale version conflicts without writing audit', async t => {
  const request = setup(t);
  stub(t, prisma, '$transaction', async (callback: any) => callback({ appContent: { updateMany: async () => ({ count: 0 }) } }));
  const response = await request('/api/admin/content/entry-1', 'PATCH', { kind: 'faq', slug: 'question', title: 'คำถาม', body: 'คำตอบ', version: 1 });
  assert.equal(response.status, 409);
});
test('plan update refuses changes to previously sold rights', async t => {
  const request = setup(t);
  assert.equal((await request('/api/admin/membership-plans/plan-1', 'PATCH', { washLimit: 999, isActive: true })).status, 400);
});

test('reward fulfillment is scoped and writes an audit without touching a wallet', async t => {
  const request = setup(t, 'branch_admin'); let writes = 0;
  stub(t, prisma.pointsTransaction, 'findFirst', async (args: any) => {
    assert.deepEqual(args.where.branchId, { in: ['branch-a'] });
    return { id, userId: 'user-1', branchId: 'branch-a', metadata: { fulfillmentStatus: 'pending' } };
  });
  stub(t, prisma, '$transaction', async (callback: any) => callback({
    pointsTransaction: { updateMany: async (args: any) => { assert.equal(args.data.metadata.fulfillmentStatus, 'fulfilled'); writes++; return { count: 1 }; } },
    auditLog: { create: async ({ data }: any) => { assert.equal(data.action, 'admin.reward.fulfill'); writes++; } },
  }));
  assert.equal((await request(`/api/admin/reward-redemptions/${id}/fulfill`, 'POST', { note: 'ส่งมอบที่เคาน์เตอร์' })).status, 200);
  assert.equal(writes, 2);
});

test('fulfilled reward retry is read-only and out-of-scope reward is hidden', async t => {
  const request = setup(t, 'branch_admin'); let exists = true;
  stub(t, prisma.pointsTransaction, 'findFirst', async () => exists ? { metadata: { fulfillmentStatus: 'fulfilled' } } : null);
  const response = await request(`/api/admin/reward-redemptions/${id}/fulfill`, 'POST', { note: 'ส่งมอบที่เคาน์เตอร์' });
  assert.equal(response.status, 200); assert.equal((await response.json()).replayed, true);
  exists = false;
  assert.equal((await request(`/api/admin/reward-redemptions/${id}/fulfill`, 'POST', { note: 'ส่งมอบที่เคาน์เตอร์' })).status, 404);
});

test('customer redemption retries never debit twice', async t => {
  const request = setup(t);
  stub(t, prisma.user, 'findUnique', async () => ({ id: 'user-1', isActive: true, deletedAt: null }));
  stub(t, prisma.pointsTransaction, 'findUnique', async () => ({ id, userId: 'user-1', type: 'redeem', amount: -50, branchId: 'branch-a', metadata: { rewardId: 'reward-1' } }));
  const token = signAccessToken('user-1');
  assert.equal((await request('/api/points/redeem', 'POST', { amount: 50, rewardId: 'reward-1', branchId: 'branch-a', requestId: id }, token)).status, 200);
  assert.equal((await request('/api/points/redeem', 'POST', { amount: 51, rewardId: 'reward-1', branchId: 'branch-a', requestId: id }, token)).status, 409);
});

test('redemption validates server cost, branch and balance before mutating', async t => {
  const request = setup(t); let scenario = 'price';
  stub(t, prisma.user, 'findUnique', async () => ({ id: 'user-1', isActive: true, deletedAt: null }));
  stub(t, prisma.pointsTransaction, 'findUnique', async () => null);
  stub(t, prisma, '$transaction', async (callback: any, options: any) => {
    assert.equal(options.isolationLevel, 'Serializable');
    return callback({
      pointWallet: { findUnique: async () => ({ id: 'wallet-1', balance: scenario === 'balance' ? 5 : 100 }) },
      rewardCatalog: { findUnique: async () => ({ id: 'reward-1', isActive: true, pointsCost: scenario === 'price' ? 60 : 50, branchIds: ['branch-a'] }) },
      branch: { findFirst: async () => scenario === 'branch' ? null : { id: 'branch-a' } },
    });
  });
  for (const mode of ['price', 'branch', 'balance']) {
    scenario = mode;
    assert.equal((await request('/api/points/redeem', 'POST', { amount: 50, rewardId: 'reward-1', branchId: 'branch-a', requestId: id }, signAccessToken('user-1'))).status, 409);
  }
});

test('membership browse preserves HQ changes and retains closed purchased plans', async t => {
  const request = setup(t);
  stub(t, prisma.user, 'findUnique', async () => ({ id: 'user-1', isActive: true, deletedAt: null }));
  stub(t, prisma.membershipPlan, 'upsert', async (args: any) => { assert.deepEqual(args.update, {}); return {}; });
  stub(t, prisma.membershipPlan, 'findMany', async () => []);
  const now = new Date();
  const plan = { id: 'closed-plan', code: 'CUSTOM', name: 'สมาชิกเดิม', washLimit: 10, grapheneLimit: 0, durationMonths: 6, group: 'bundle', isActive: false };
  stub(t, prisma.userMembership, 'findMany', async () => [{ id: 'member-1', planId: plan.id, plan, status: 'active', createdAt: now, updatedAt: now }]);
  const response = await request('/api/memberships/me', 'GET', undefined, signAccessToken('user-1'));
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.data.plans[0].isAvailable, false); assert.equal(body.data.plans[0].active, true);
});

test('test activation is disabled by default without touching membership records', async t => {
  const request = setup(t); const original = process.env.MEMBERSHIP_ALLOW_TEST_ACTIVATION;
  delete process.env.MEMBERSHIP_ALLOW_TEST_ACTIVATION;
  t.after(() => { if (original === undefined) delete process.env.MEMBERSHIP_ALLOW_TEST_ACTIVATION; else process.env.MEMBERSHIP_ALLOW_TEST_ACTIVATION = original; });
  stub(t, prisma.user, 'findUnique', async () => ({ id: 'user-1', isActive: true, deletedAt: null }));
  assert.equal((await request('/api/memberships/activate', 'POST', {}, signAccessToken('user-1'))).status, 403);
});

test('membership approve and reject reject stale pending records without an audit', async t => {
  const request = setup(t); const now = new Date();
  stub(t, prisma.userMembership, 'findUnique', async () => ({ id: 'member-1', status: 'pending', updatedAt: now, plan: { code: 'CUSTOM', durationMonths: 6 }, metadata: { purchase: { slipUploadedAt: now.toISOString() } } }));
  stub(t, prisma, '$transaction', async (callback: any) => callback({ userMembership: { updateMany: async (args: any) => {
    assert.equal(args.where.status, 'pending'); assert.equal(args.where.updatedAt, now); return { count: 0 };
  } } }));
  for (const action of ['approve', 'reject']) assert.equal((await request(`/api/admin/membership-purchases/member-1/${action}`, 'POST', {})).status, 409);
});
