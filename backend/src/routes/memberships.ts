import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AppEnv } from '../lib/types.js';
import { requireAuth } from '../middleware/auth.js';

export const membershipRoutes = new Hono<AppEnv>();

membershipRoutes.use('*', requireAuth);

const DEFAULT_PLAN_CODE = 'GRAPHENE_MEMBERSHIP';

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

function getCatalogItem(code: string) {
  return membershipCatalog.find((item) => item.code === code) ?? membershipCatalog[0];
}

async function ensureMembershipPlans() {
  await Promise.all(
    membershipCatalog.map((item) =>
      prisma.membershipPlan.upsert({
        where: { code: item.code },
        update: {
          name: item.name,
          description: item.description,
          price: item.price,
          currency: 'THB',
          washLimit: item.washLimit,
          grapheneLimit: item.grapheneLimit,
          freeVacuumPerVisit: item.freeVacuumPerVisit,
          vipFastLane: item.vipFastLane,
          isActive: true,
          sortOrder: item.sortOrder,
        },
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
        },
      })
    )
  );

  return prisma.membershipPlan.findMany({
    where: { code: { in: membershipCatalog.map((item) => item.code) }, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

function buildReference() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MEM-${Date.now()}-${suffix}`;
}

function mapPlan(plan: Awaited<ReturnType<typeof ensureMembershipPlans>>[number]) {
  const catalog = getCatalogItem(plan.code);

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
      planId: { in: plans.map((plan) => plan.id) },
      status: { in: ['active', 'pending'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
  const featuredPlan = plans.find((plan) => plan.code === DEFAULT_PLAN_CODE) ?? plans[0];
  const featuredMembership = memberships.find((membership) => membership.planId === featuredPlan.id) ?? null;
  const planMemberships = new Map(memberships.map((membership) => [membership.planId, membership]));

  return c.json({
    data: {
      ...mapMembership(featuredPlan, featuredMembership),
      plans: plans.map((plan) => {
        const overview = mapMembership(plan, planMemberships.get(plan.id) ?? null);
        return {
          ...overview.plan,
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

  const catalog = getCatalogItem(plan.code);
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
