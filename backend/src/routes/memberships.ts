import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AppEnv } from '../lib/types.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

export const membershipRoutes = new Hono<AppEnv>();

membershipRoutes.use('*', requireAuth);

const DEFAULT_PLAN_CODE = 'GRAPHENE_MEMBERSHIP';

// HQ PromptPay account that receives membership payments. Override via env so the
// real account can be set without a code change (MEMBERSHIP_PROMPTPAY_ID/NAME).
const MEMBERSHIP_PROMPTPAY_ID = process.env.MEMBERSHIP_PROMPTPAY_ID || '0812345678';
const MEMBERSHIP_PROMPTPAY_NAME = process.env.MEMBERSHIP_PROMPTPAY_NAME || 'ROBOSS สมาชิก (สำนักงานใหญ่)';
const MEMBERSHIP_SLIP_MAX_BYTES = 1_500_000;
const MEMBERSHIP_SLIP_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function membershipMeta(membership: { metadata: unknown }): Record<string, any> {
  const meta = membership.metadata;
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...(meta as Record<string, any>) } : {};
}

// CRC-16/CCITT-FALSE (init 0xFFFF, poly 0x1021) — required by the EMVCo QR spec.
function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, '0') + value;
}

// Real EMVCo PromptPay QR (Bank of Thailand standard). Scannable by any bank app.
// target = phone (10 digits, sub-tag 01) or national ID (13 digits, sub-tag 02).
function buildMembershipQrPayload(amount: number): string {
  const target = MEMBERSHIP_PROMPTPAY_ID.replace(/[^0-9]/g, '');
  const isTaxId = target.length >= 13;
  const value = isTaxId ? target : ('0000000000000' + target.replace(/^0/, '66')).slice(-13);
  const merchant = tlv('29', tlv('00', 'A000000677010111') + tlv(isTaxId ? '02' : '01', value));
  const payloadNoCrc =
    tlv('00', '01') +
    tlv('01', '12') + // 12 = dynamic (amount specified)
    merchant +
    tlv('58', 'TH') + // country (order matches BOT/promptpay-qr canonical output)
    tlv('53', '764') + // currency THB
    tlv('54', amount.toFixed(2)) +
    '6304';
  return payloadNoCrc + crc16ccitt(payloadNoCrc);
}

function mapMembershipPurchase(plan: { code: string; name: string }, membership: any) {
  const meta = membershipMeta(membership);
  const purchase = (meta.purchase && typeof meta.purchase === 'object' ? meta.purchase : {}) as Record<string, any>;
  return {
    id: membership.id,
    planCode: plan.code,
    planName: plan.name,
    amount: membership.paymentAmount,
    currency: membership.paymentCurrency,
    reference: membership.paymentReference,
    status: membership.status,
    purchaseStatus: purchase.status ?? (membership.status === 'active' ? 'confirmed' : 'pending_transfer'),
    promptPayId: MEMBERSHIP_PROMPTPAY_ID,
    promptPayName: MEMBERSHIP_PROMPTPAY_NAME,
    qrPayload: buildMembershipQrPayload(membership.paymentAmount),
    slipUploadedAt: purchase.slipUploadedAt ?? null,
    expiresAt: purchase.expiresAt ?? null,
  };
}

const activateMembershipSchema = z.object({
  planCode: z.string().min(1).optional(),
});

const membershipCatalog = [
  {
    id: 'plan_graphene_1290',
    code: DEFAULT_PLAN_CODE,
    name: 'ROBOSS Graphene Bundle',
    headline: '10 Washes + 2 Graphene Shield',
    description: '10 washes, 2 Graphene Shield upgrades, free vacuum every visit, and VIP Fast Lane.',
    price: 1290,
    washLimit: 10,
    grapheneLimit: 2,
    freeVacuumPerVisit: true,
    vipFastLane: true,
    group: 'best_seller',
    groupLabel: 'Best Seller',
    termLabel: 'Valid 12 months',
    durationMonths: 12,
    sortOrder: 1,
    badge: 'Best conversion',
  },
  {
    id: 'plan_quick_pass_777',
    code: 'QUICK_PASS_777',
    name: 'Quick Pass 777',
    headline: 'Unlimited Quick Wash',
    description: 'Daily Quick & Clean access for frequent car users. Fair-use limit is 30 washes per month.',
    price: 777,
    washLimit: 30,
    grapheneLimit: 0,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    durationMonths: 1,
    sortOrder: 2,
    badge: 'Traffic driver',
  },
  {
    id: 'plan_black_card_1499',
    code: 'BLACK_CARD_1499',
    name: 'ROBOSS Black Card',
    headline: 'Unlimited Quick + Vacuum + Priority',
    description: 'Premium monthly card with Quick Wash credits, free vacuum every visit, and queue priority.',
    price: 1499,
    washLimit: 30,
    grapheneLimit: 0,
    freeVacuumPerVisit: true,
    vipFastLane: true,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    durationMonths: 1,
    sortOrder: 3,
    badge: 'VIP',
  },
  {
    id: 'plan_graphene_club_399',
    code: 'GRAPHENE_CLUB_399',
    name: 'Graphene Club',
    headline: '2 Graphene upgrades per month',
    description: 'Monthly Graphene Shield upgrade credits for customers who want shine and margin-heavy add-ons.',
    price: 399,
    washLimit: 0,
    grapheneLimit: 2,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    durationMonths: 1,
    sortOrder: 4,
    badge: 'Margin',
  },
  {
    id: 'plan_family_pack_1299',
    code: 'FAMILY_PACK_1299',
    name: 'Family Pack',
    headline: '20 washes for 2 cars',
    description: 'Shared monthly wash credits for two registered cars in one household.',
    price: 1299,
    washLimit: 20,
    grapheneLimit: 0,
    freeVacuumPerVisit: true,
    vipFastLane: false,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    durationMonths: 1,
    sortOrder: 5,
    badge: 'Family',
  },
  {
    id: 'plan_rider_pass_299',
    code: 'RIDER_PASS_299',
    name: 'Rider Pass',
    headline: 'Motorcycle wash pass',
    description: 'Motorcycle wash access for rider customers. Fair-use limit is 30 motorcycle washes per month.',
    price: 299,
    washLimit: 30,
    grapheneLimit: 0,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'motorcycle',
    groupLabel: 'Motorcycle',
    termLabel: 'Monthly',
    durationMonths: 1,
    sortOrder: 6,
    badge: 'Bike',
  },
  {
    id: 'plan_buy_10_get_2_999',
    code: 'BUY_10_GET_2_999',
    name: 'Buy 10 Get 2',
    headline: '12 wash credits',
    description: 'Prepaid bundle: buy 10 washes and get 2 bonus washes.',
    price: 999,
    washLimit: 12,
    grapheneLimit: 0,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'bundle',
    groupLabel: 'Prepaid Bundle',
    termLabel: 'Valid 6 months',
    durationMonths: 6,
    sortOrder: 7,
    badge: 'Bundle',
  },
  {
    id: 'plan_shine_pass_1499',
    code: 'SHINE_PASS_1499',
    name: 'Shine Pass',
    headline: '10 Shine washes + vacuum',
    description: 'Premium prepaid Shine Mode bundle with vacuum included.',
    price: 1499,
    washLimit: 10,
    grapheneLimit: 0,
    freeVacuumPerVisit: true,
    vipFastLane: false,
    group: 'bundle',
    groupLabel: 'Prepaid Bundle',
    termLabel: 'Valid 6 months',
    durationMonths: 6,
    sortOrder: 8,
    badge: 'Premium',
  },
] as const;

type MembershipCatalogItem = (typeof membershipCatalog)[number];

function getCatalogItem(plan: { code: string; name: string; washLimit: number; grapheneLimit: number; durationMonths: number; group: string }) {
  return membershipCatalog.find((item) => item.code === plan.code) ?? {
    headline: `${plan.washLimit} สิทธิ์ล้าง · ${plan.grapheneLimit} สิทธิ์เคลือบ`,
    group: plan.group, groupLabel: plan.group === 'motorcycle' ? 'Motorcycle' : plan.group === 'membership' ? 'Monthly Membership' : 'Prepaid Bundle',
    termLabel: `${plan.durationMonths} เดือน`, durationMonths: plan.durationMonths, badge: '',
  };
}

async function ensureMembershipPlans() {
  await Promise.all(
    membershipCatalog.map((item) =>
      prisma.membershipPlan.upsert({
        where: { code: item.code },
        // Existing plans are managed by HQ; browsing must never overwrite them.
        update: {},
        create: {
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: 'THB',
          washLimit: item.washLimit,
          grapheneLimit: item.grapheneLimit,
          freeVacuumPerVisit: item.freeVacuumPerVisit,
          vipFastLane: item.vipFastLane,
          sortOrder: item.sortOrder,
          durationMonths: item.durationMonths,
          group: item.group,
        },
      })
    )
  );

  return prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

function buildReference() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MEM-${Date.now()}-${suffix}`;
}

function mapPlan(plan: Awaited<ReturnType<typeof ensureMembershipPlans>>[number]) {
  const catalog = getCatalogItem(plan);

  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    headline: catalog.headline,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    washLimit: plan.washLimit,
    grapheneLimit: plan.grapheneLimit,
    freeVacuumPerVisit: plan.freeVacuumPerVisit,
    vipFastLane: plan.vipFastLane,
    group: catalog.group,
    groupLabel: catalog.groupLabel,
    termLabel: catalog.termLabel,
    badge: catalog.badge,
    sortOrder: plan.sortOrder,
  };
}

function mapMembership(plan: Awaited<ReturnType<typeof ensureMembershipPlans>>[number], membership: any | null) {
  const isActive = membership?.status === 'active';
  const washUsed = membership?.washUsed ?? 0;
  const grapheneUsed = membership?.grapheneUsed ?? 0;
  const washRemaining = Math.max(plan.washLimit - washUsed, 0);
  const grapheneRemaining = Math.max(plan.grapheneLimit - grapheneUsed, 0);

  return {
    plan: mapPlan(plan),
    membership: membership
      ? {
          id: membership.id,
          status: membership.status,
          washUsed,
          grapheneUsed,
          washRemaining,
          grapheneRemaining,
          paymentAmount: membership.paymentAmount,
          paymentCurrency: membership.paymentCurrency,
          paymentStatus: membership.paymentStatus,
          paymentReference: membership.paymentReference,
          activatedAt: membership.activatedAt?.toISOString() ?? null,
          expiresAt: membership.expiresAt?.toISOString() ?? null,
          cancelledAt: membership.cancelledAt?.toISOString() ?? null,
          lastUsedAt: membership.lastUsedAt?.toISOString() ?? null,
          createdAt: membership.createdAt.toISOString(),
          updatedAt: membership.updatedAt.toISOString(),
        }
      : null,
    active: isActive,
    benefits: [
      {
        key: 'washes',
        title: `${plan.washLimit} Washes`,
        description: plan.washLimit > 0 ? `${plan.washLimit} wash credits included` : 'No wash credits in this package',
        used: washUsed,
        limit: plan.washLimit,
        remaining: washRemaining,
        enabled: isActive && washRemaining > 0 && plan.washLimit > 0,
      },
      {
        key: 'graphene_shield',
        title: `${plan.grapheneLimit}x Graphene Shield`,
        description: plan.grapheneLimit > 0 ? `${plan.grapheneLimit} premium Graphene Shield credits` : 'No Graphene credits in this package',
        used: grapheneUsed,
        limit: plan.grapheneLimit,
        remaining: grapheneRemaining,
        enabled: isActive && grapheneRemaining > 0 && plan.grapheneLimit > 0,
      },
      {
        key: 'free_vacuum',
        title: 'Free Vacuum Every Visit',
        description: 'Free vacuum is included each time a wash credit is used',
        used: isActive ? washUsed : 0,
        limit: plan.washLimit || null,
        remaining: isActive ? washRemaining : 0,
        enabled: isActive && plan.freeVacuumPerVisit && (plan.washLimit === 0 || washRemaining > 0),
      },
      {
        key: 'vip_fast_lane',
        title: 'VIP Fast Lane',
        description: 'Priority service lane for Graphene members',
        used: 0,
        limit: null,
        remaining: null,
        enabled: isActive && plan.vipFastLane,
      },
    ],
  };
}

membershipRoutes.get('/me', async (c) => {
  const userId = c.get('userId');
  const plans = await ensureMembershipPlans();
  const memberships = await prisma.userMembership.findMany({
    where: {
      userId,
      status: { in: ['active', 'pending'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
  // Purchased rights stay visible even after a plan is removed from sale.
  const visiblePlans = [...new Map([...plans, ...memberships.map(item => item.plan)].map(plan => [plan.id, plan])).values()];
  const featuredPlan = visiblePlans.find((plan) => plan.code === DEFAULT_PLAN_CODE) ?? visiblePlans[0];
  const featuredMembership = featuredPlan ? memberships.find((membership) => membership.planId === featuredPlan.id) ?? null : null;
  const planMemberships = new Map([...memberships].reverse().map((membership) => [membership.planId, membership]));

  return c.json({
    data: {
      ...(featuredPlan ? mapMembership(featuredPlan, featuredMembership) : { plan: null, membership: null, active: false, benefits: [] }),
      plans: visiblePlans.map((plan) => {
        const overview = mapMembership(plan, planMemberships.get(plan.id) ?? null);
        return {
          ...overview.plan,
          isAvailable: plan.isActive,
          membership: overview.membership,
          active: overview.active,
          benefits: overview.benefits,
        };
      }),
      memberships: memberships.map((membership) => mapMembership(membership.plan, membership).membership),
      groups: [
        { key: 'best_seller', label: 'Best Seller', description: 'ตัวหลักที่ขายง่ายและคุม margin ได้ดี' },
        { key: 'membership', label: 'Monthly Membership', description: 'รายได้ประจำและสิทธิ์ active member' },
        { key: 'bundle', label: 'Prepaid Bundle', description: 'เติมเงินล่วงหน้า ใช้เครดิตเป็นครั้ง' },
        { key: 'motorcycle', label: 'Motorcycle', description: 'แพ็กสำหรับลูกค้ามอเตอร์ไซค์' },
      ],
      promoPlaybook: {
        traffic: ['Quick 99', 'Morning 79', 'Night Owl 89'],
        profit: ['Shine Mode', 'Vacuum add-on', 'Foam Party'],
        margin: ['Graphene +99', 'Ceramic Day'],
        loyalty: ['Point Boost Day', 'Refer & Wash', 'Rain Challenge'],
      },
    },
  });
});

membershipRoutes.post('/activate', async (c) => {
  if (process.env.NODE_ENV === 'production' || process.env.MEMBERSHIP_ALLOW_TEST_ACTIVATION !== 'true') {
    return c.json({ message: 'ใช้ขั้นตอนซื้อสมาชิกและตรวจสอบการชำระเงินก่อนเปิดสิทธิ์' }, 403);
  }
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const { planCode = DEFAULT_PLAN_CODE } = activateMembershipSchema.parse(body);
  const plans = await ensureMembershipPlans();
  const plan = plans.find((item) => item.code === planCode);

  if (!plan) {
    return c.json({ message: 'Membership plan not found' }, 404);
  }

  const existing = await prisma.userMembership.findFirst({
    where: {
      userId,
      planId: plan.id,
      status: 'active',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return c.json({ data: mapMembership(plan, existing) });
  }

  const catalog = getCatalogItem(plan);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + catalog.durationMonths);

  const membership = await prisma.userMembership.create({
    data: {
      userId,
      planId: plan.id,
      status: 'active',
      washUsed: 0,
      grapheneUsed: 0,
      paymentAmount: plan.price,
      paymentCurrency: plan.currency,
      paymentStatus: 'mock_confirmed',
      paymentReference: buildReference(),
      activatedAt: now,
      expiresAt,
      metadata: {
        activationSource: 'customer_app',
        activationMode: 'mock_confirmed_for_local_testing',
        planCode: plan.code,
        planGroup: catalog.group,
        termLabel: catalog.termLabel,
      },
    },
  });

  return c.json({ data: mapMembership(plan, membership) }, 201);
});

// ── Real purchase flow: pending -> PromptPay + slip -> admin approve -> active ──

// Create (or resume) a pending membership purchase. Does NOT activate.
membershipRoutes.post('/purchase', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const { planCode = DEFAULT_PLAN_CODE } = activateMembershipSchema.parse(body);
  const plans = await ensureMembershipPlans();
  const plan = plans.find((item) => item.code === planCode);
  if (!plan) {
    return c.json({ message: 'Membership plan not found' }, 404);
  }

  const active = await prisma.userMembership.findFirst({
    where: { userId, planId: plan.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (active) {
    return c.json({ message: 'แพ็กเกจนี้กำลังใช้งานอยู่แล้ว' }, 409);
  }

  let pending = await prisma.userMembership.findFirst({
    where: { userId, planId: plan.id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  if (pending) {
    const pendingPurchase = membershipMeta(pending).purchase as Record<string, unknown> | undefined;
    const expiresAt = typeof pendingPurchase?.expiresAt === 'string' ? Date.parse(pendingPurchase.expiresAt) : NaN;
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      await prisma.userMembership.update({
        where: { id: pending.id },
        data: {
          status: 'cancelled',
          paymentStatus: 'expired',
          cancelledAt: new Date(),
          metadata: {
            ...membershipMeta(pending),
            purchase: { ...pendingPurchase, status: 'expired', expiredAt: new Date().toISOString() },
          },
        },
      });
      pending = null;
    }
  }

  if (!pending) {
    const now = new Date();
    const reference = buildReference();
    pending = await prisma.userMembership.create({
      data: {
        userId,
        planId: plan.id,
        status: 'pending',
        paymentAmount: plan.price,
        paymentCurrency: plan.currency,
        paymentStatus: 'pending',
        paymentReference: reference,
        metadata: {
          purchase: {
            status: 'pending_transfer',
            promptPayId: MEMBERSHIP_PROMPTPAY_ID,
            promptPayName: MEMBERSHIP_PROMPTPAY_NAME,
            reference,
            amount: plan.price,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          },
        },
      },
    });
  }

  return c.json({ data: mapMembershipPurchase(plan, pending) }, 201);
});

// Upload the transfer slip for a pending purchase -> pending_review (awaits admin).
membershipRoutes.post('/purchase/:id/slip', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const membership = await prisma.userMembership.findUnique({ where: { id }, include: { plan: true } });
  if (!membership || membership.userId !== userId) {
    return c.json({ message: 'Membership purchase not found' }, 404);
  }
  if (membership.status !== 'pending') {
    return c.json({ message: 'รายการนี้ไม่สามารถอัปสลิปได้' }, 400);
  }

  const parsed = await c.req.raw.formData();
  const file = parsed.get('file');
  if (!(file instanceof File)) {
    return c.json({ message: 'กรุณาแนบไฟล์สลิป' }, 400);
  }
  if (!MEMBERSHIP_SLIP_MIME_TYPES.has(file.type)) {
    return c.json({ message: 'รองรับสลิปไฟล์ JPG, PNG หรือ WebP เท่านั้น' }, 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MEMBERSHIP_SLIP_MAX_BYTES) {
    return c.json({ message: 'ไฟล์สลิปต้องมีขนาดไม่เกิน 1.5 MB' }, 400);
  }
  const slipImageHash = createHash('sha256').update(bytes).digest('hex');

  const meta = membershipMeta(membership);
  const currentPurchase = (meta.purchase && typeof meta.purchase === 'object' ? meta.purchase : {}) as Record<string, any>;
  const expiresAt = typeof currentPurchase.expiresAt === 'string' ? Date.parse(currentPurchase.expiresAt) : NaN;
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    await prisma.userMembership.update({
      where: { id },
      data: {
        status: 'cancelled',
        paymentStatus: 'expired',
        cancelledAt: new Date(),
        metadata: {
          ...meta,
          purchase: { ...currentPurchase, status: 'expired', expiredAt: new Date().toISOString() },
        },
      },
    });
    return c.json({ message: 'รายการชำระเงินหมดอายุแล้ว กรุณาสร้างรายการใหม่' }, 400);
  }

  const duplicatedSlip = await prisma.userMembership.findFirst({
    where: {
      id: { not: id },
      status: { in: ['pending', 'active'] },
      metadata: { path: ['purchase', 'slipImageHash'], equals: slipImageHash },
    },
    select: { paymentReference: true },
  });
  if (duplicatedSlip) {
    return c.json({ message: `สลิปนี้ถูกใช้กับรายการ ${duplicatedSlip.paymentReference ?? '-'} แล้ว` }, 400);
  }

  const slipImage = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`;
  meta.purchase = {
    ...currentPurchase,
    status: 'pending_review',
    slipUploadedAt: new Date().toISOString(),
    slipFileName: file.name || 'slip.jpg',
    slipMimeType: file.type,
    slipImage,
    slipImageHash,
  };

  const updated = await prisma.userMembership.update({
    where: { id },
    data: { metadata: meta as any, paymentStatus: 'pending_review' },
    include: { plan: true },
  });

  return c.json({ data: mapMembershipPurchase(updated.plan, updated) });
});

// List the customer's own membership purchases (pending + recent).
membershipRoutes.get('/purchases', async (c) => {
  const userId = c.get('userId');
  const items = await prisma.userMembership.findMany({
    where: { userId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return c.json({ data: items.map((item) => mapMembershipPurchase(item.plan, item)) });
});

// ── Admin: review + approve/reject membership purchases (separate router) ──
export const adminMembershipRoutes = new Hono<AppEnv>();
adminMembershipRoutes.use('*', requireAdmin);
adminMembershipRoutes.use('*', async (c, next) => {
  if (c.get('adminRole') !== 'hq_admin') {
    return c.json({ message: 'HQ admin access required' }, 403);
  }
  await next();
});

adminMembershipRoutes.get('/', async (c) => {
  const items = await prisma.userMembership.findMany({
    where: { status: 'pending' },
    include: { plan: true, user: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return c.json({
    data: items.map((m) => {
      const meta = membershipMeta(m);
      const purchase = (meta.purchase && typeof meta.purchase === 'object' ? meta.purchase : {}) as Record<string, any>;
      return {
        id: m.id,
        userName: m.user.displayName,
        planName: m.plan.name,
        amount: m.paymentAmount,
        reference: m.paymentReference,
        status: m.status,
        purchaseStatus: purchase.status ?? 'pending_transfer',
        slipUploadedAt: purchase.slipUploadedAt ?? null,
        slipFileName: purchase.slipFileName ?? null,
        slipMimeType: purchase.slipMimeType ?? null,
        slipImage: purchase.slipImage ?? null,
        slipImageHash: typeof purchase.slipImageHash === 'string' ? purchase.slipImageHash.slice(0, 12) : null,
        createdAt: m.createdAt.toISOString(),
      };
    }),
  });
});

adminMembershipRoutes.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const membership = await prisma.userMembership.findUnique({ where: { id }, include: { plan: true } });
  if (!membership) {
    return c.json({ message: 'Membership purchase not found' }, 404);
  }
  if (membership.status === 'active') {
    return c.json({ data: mapMembership(membership.plan, membership) });
  }
  if (membership.status !== 'pending') {
    return c.json({ message: `Membership is ${membership.status} and cannot be approved` }, 400);
  }
  const meta = membershipMeta(membership);
  const purchase = (meta.purchase && typeof meta.purchase === 'object' ? meta.purchase : {}) as Record<string, any>;
  if (!purchase.slipUploadedAt) {
    return c.json({ message: 'Slip must be uploaded before approval' }, 400);
  }

  const catalog = getCatalogItem(membership.plan);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + catalog.durationMonths);
  meta.purchase = { ...purchase, status: 'confirmed', confirmedAt: now.toISOString() };

  const updated = await prisma.$transaction(async tx => {
    const changed = await tx.userMembership.updateMany({
    where: { id, status: 'pending', updatedAt: membership.updatedAt },
    data: {
      status: 'active',
      paymentStatus: 'confirmed',
      activatedAt: now,
      expiresAt,
      metadata: meta as any,
    },
    });
    if (!changed.count) return null;
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: c.get('adminId'), action: 'admin.membership.approve', entityType: 'membership', entityId: id, metadata: { paymentReference: membership.paymentReference, amount: membership.paymentAmount } } });
    return tx.userMembership.findUniqueOrThrow({ where: { id }, include: { plan: true } });
  });
  if (!updated) return c.json({ message: 'รายการเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่ก่อนอนุมัติ' }, 409);
  return c.json({ data: mapMembership(updated.plan, updated) });
});

adminMembershipRoutes.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const membership = await prisma.userMembership.findUnique({ where: { id }, include: { plan: true } });
  if (!membership) {
    return c.json({ message: 'Membership purchase not found' }, 404);
  }
  if (membership.status !== 'pending') {
    return c.json({ message: `Membership is ${membership.status} and cannot be rejected` }, 400);
  }
  const meta = membershipMeta(membership);
  meta.purchase = {
    ...(meta.purchase && typeof meta.purchase === 'object' ? meta.purchase : {}),
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
  };
  const updated = await prisma.$transaction(async tx => {
    const changed = await tx.userMembership.updateMany({
      where: { id, status: 'pending', updatedAt: membership.updatedAt },
      data: { status: 'cancelled', paymentStatus: 'rejected', cancelledAt: new Date(), metadata: meta as any },
    });
    if (!changed.count) return null;
    await tx.auditLog.create({ data: { actorType: 'admin', adminUserId: c.get('adminId'), action: 'admin.membership.reject', entityType: 'membership', entityId: id, metadata: { paymentReference: membership.paymentReference } } });
    return tx.userMembership.findUniqueOrThrow({ where: { id }, include: { plan: true } });
  });
  if (!updated) return c.json({ message: 'รายการเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่ก่อนปฏิเสธ' }, 409);
  return c.json({ data: mapMembershipPurchase(updated.plan, updated) });
});
