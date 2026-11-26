// Local (mock) membership store + PromptPay purchase flow.
//
// Used when the app runs without a backend (USE_LOCAL_DEV_FALLBACK). It mirrors
// the server membership model closely enough to demo the full buy flow:
//   pick plan -> PromptPay QR + reference -> "I paid" -> membership active.
//
// Active plan codes are persisted under GRAPHENE_MEMBERSHIP_STORAGE_KEY (a JSON
// array of plan codes). MemberCard reads the same key, so a plan purchased here
// shows up in the member card automatically.

import type { MembershipBenefit, MembershipOverview, MembershipPlan } from '@/types';

export const GRAPHENE_MEMBERSHIP_STORAGE_KEY = 'roboss_graphene_membership_active';
export const MEMBERSHIP_PURCHASES_STORAGE_KEY = 'roboss_membership_purchases';
export const DEFAULT_MEMBER_PLAN_CODE = 'GRAPHENE_MEMBERSHIP';

// Brand-level PromptPay account that receives membership payments (HQ).
const MEMBERSHIP_PROMPTPAY_ID = '0812345678';
const MEMBERSHIP_PROMPTPAY_NAME = 'ROBOSS สมาชิก (สำนักงานใหญ่)';

// Canonical local plan list. Codes MUST match MemberCard so purchases surface there.
export const localMemberPlans: MembershipPlan[] = [
  {
    id: 'plan_graphene_1290',
    code: DEFAULT_MEMBER_PLAN_CODE,
    name: 'ROBOSS Graphene Bundle',
    headline: '10 Washes + 2 Graphene Shield',
    description: '10 washes, 2x Graphene Shield, free vacuum, VIP Fast Lane',
    price: 1290,
    currency: 'THB',
    washLimit: 10,
    grapheneLimit: 2,
    freeVacuumPerVisit: true,
    vipFastLane: true,
    group: 'best_seller',
    groupLabel: 'Best Seller',
    termLabel: 'Valid 12 months',
    badge: 'Best conversion',
    sortOrder: 1,
  },
  {
    id: 'plan_quick_pass_777',
    code: 'QUICK_PASS_777',
    name: 'Quick Pass 777',
    headline: 'Unlimited Quick Wash',
    description: 'Fair-use 30 Quick washes per month',
    price: 777,
    currency: 'THB',
    washLimit: 30,
    grapheneLimit: 0,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    badge: 'Traffic driver',
    sortOrder: 2,
  },
  {
    id: 'plan_black_card_1499',
    code: 'BLACK_CARD_1499',
    name: 'ROBOSS Black Card',
    headline: 'Quick + Vacuum + Priority',
    description: 'Premium monthly active member card',
    price: 1499,
    currency: 'THB',
    washLimit: 30,
    grapheneLimit: 0,
    freeVacuumPerVisit: true,
    vipFastLane: true,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    badge: 'VIP',
    sortOrder: 3,
  },
  {
    id: 'plan_buy_10_get_2_999',
    code: 'BUY_10_GET_2_999',
    name: 'Buy 10 Get 2',
    headline: '12 wash credits',
    description: 'Prepaid bundle for repeat customers',
    price: 999,
    currency: 'THB',
    washLimit: 12,
    grapheneLimit: 0,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'bundle',
    groupLabel: 'Prepaid Bundle',
    termLabel: 'Valid 6 months',
    badge: 'Bundle',
    sortOrder: 7,
  },
];

export function findLocalPlan(planCode: string): MembershipPlan | undefined {
  return localMemberPlans.find((plan) => plan.code === planCode);
}

function buildPlanBenefits(plan: MembershipPlan, active: boolean): MembershipBenefit[] {
  return [
    {
      key: 'washes',
      title: `${plan.washLimit} Washes`,
      description: plan.washLimit > 0 ? 'Wash credits unlocked after activation' : 'No wash credits',
      used: 0,
      limit: plan.washLimit,
      remaining: active ? plan.washLimit : 0,
      enabled: active && plan.washLimit > 0,
    },
    {
      key: 'graphene_shield',
      title: `${plan.grapheneLimit}x Graphene`,
      description: plan.grapheneLimit > 0 ? 'Graphene Shield upgrade credits' : 'No Graphene credits',
      used: 0,
      limit: plan.grapheneLimit,
      remaining: active ? plan.grapheneLimit : 0,
      enabled: active && plan.grapheneLimit > 0,
    },
    {
      key: 'free_vacuum',
      title: 'Free Vacuum',
      description: 'Included every eligible visit',
      used: 0,
      limit: plan.washLimit || null,
      remaining: active ? plan.washLimit : 0,
      enabled: active && plan.freeVacuumPerVisit,
    },
    {
      key: 'vip_fast_lane',
      title: 'VIP Fast Lane',
      description: 'Priority service queue',
      used: 0,
      limit: null,
      remaining: null,
      enabled: active && plan.vipFastLane,
    },
  ];
}

export function buildLocalMembershipOverview(activePlanCodes: string[]): MembershipOverview {
  const now = new Date().toISOString();
  const plans = localMemberPlans.map((plan) => {
    const active = activePlanCodes.includes(plan.code);
    return {
      ...plan,
      active,
      benefits: buildPlanBenefits(plan, active),
      membership: active
        ? {
            id: `local_${plan.code.toLowerCase()}`,
            status: 'active' as const,
            washUsed: 0,
            grapheneUsed: 0,
            washRemaining: plan.washLimit,
            grapheneRemaining: plan.grapheneLimit,
            paymentAmount: plan.price,
            paymentCurrency: plan.currency,
            paymentStatus: 'local_confirmed',
            paymentReference: `LOCAL-${plan.code}`,
            activatedAt: now,
            expiresAt: null,
            cancelledAt: null,
            lastUsedAt: null,
            createdAt: now,
            updatedAt: now,
          }
        : null,
    };
  });
  const featured = plans.find((plan) => plan.code === DEFAULT_MEMBER_PLAN_CODE) ?? plans[0];

  return {
    plan: featured,
    membership: featured.membership ?? null,
    active: Boolean(featured.active),
    benefits: featured.benefits ?? [],
    plans,
    memberships: plans.map((plan) => plan.membership).filter(Boolean) as MembershipOverview['memberships'],
    groups: [
      { key: 'best_seller', label: 'Best Seller', description: 'ตัวหลักที่ขายง่ายและคุม margin ได้ดี' },
      { key: 'membership', label: 'Monthly Membership', description: 'รายได้ประจำและสิทธิ์ active member' },
      { key: 'bundle', label: 'Prepaid Bundle', description: 'เติมเงินล่วงหน้า ใช้เครดิตเป็นครั้ง' },
    ],
  };
}

// ── active plan codes persistence ──────────────────────────────────────────

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

export function listenToLocalMemberships(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function readLocalActivePlanCodes(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(GRAPHENE_MEMBERSHIP_STORAGE_KEY);
  if (stored === 'true') return [DEFAULT_MEMBER_PLAN_CODE]; // legacy value
  try {
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocalActivePlanCodes(codes: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GRAPHENE_MEMBERSHIP_STORAGE_KEY, JSON.stringify([...new Set(codes)]));
  emit();
}

export function activateLocalMembership(planCode: string) {
  const codes = readLocalActivePlanCodes();
  if (!codes.includes(planCode)) {
    writeLocalActivePlanCodes([...codes, planCode]);
  }
}

// ── PromptPay purchase flow ────────────────────────────────────────────────

export type LocalMembershipPurchaseStatus = 'pending' | 'confirmed';

export interface LocalMembershipPurchase {
  id: string;
  planCode: string;
  planName: string;
  amount: number;
  currency: string;
  reference: string;
  qrPayload: string;
  promptPayId: string;
  promptPayName: string;
  status: LocalMembershipPurchaseStatus;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
}

function readPurchases(): LocalMembershipPurchase[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MEMBERSHIP_PURCHASES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePurchases(purchases: LocalMembershipPurchase[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MEMBERSHIP_PURCHASES_STORAGE_KEY, JSON.stringify(purchases));
}

export function readLocalMembershipPurchases(): LocalMembershipPurchase[] {
  return readPurchases();
}

function buildReference(plan: MembershipPlan): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `RB-MEM-${plan.code.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}-${stamp}-${suffix}`;
}

function buildPromptPayPayload(plan: MembershipPlan, reference: string): string {
  const params = new URLSearchParams({
    recipient: MEMBERSHIP_PROMPTPAY_ID,
    name: MEMBERSHIP_PROMPTPAY_NAME,
    amount: String(plan.price),
    reference,
    note: `ROBOSS Membership · ${plan.name}`,
    provider: 'mock_promptpay',
  });
  return `promptpay://pay?${params.toString()}`;
}

/** Create a pending PromptPay purchase for a plan (no activation yet). */
export function createLocalMembershipPurchase(planCode: string): LocalMembershipPurchase {
  const plan = findLocalPlan(planCode);
  if (!plan) throw new Error(`Unknown membership plan: ${planCode}`);
  const now = new Date();
  const reference = buildReference(plan);
  const purchase: LocalMembershipPurchase = {
    id: `mempur_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    planCode: plan.code,
    planName: plan.name,
    amount: plan.price,
    currency: plan.currency,
    reference,
    qrPayload: buildPromptPayPayload(plan, reference),
    promptPayId: MEMBERSHIP_PROMPTPAY_ID,
    promptPayName: MEMBERSHIP_PROMPTPAY_NAME,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    confirmedAt: null,
  };
  writePurchases([purchase, ...readPurchases()].slice(0, 50));
  return purchase;
}

/** Confirm a purchase ("I paid") -> activate the membership. */
export function confirmLocalMembershipPurchase(purchaseId: string): LocalMembershipPurchase | null {
  const purchases = readPurchases();
  const index = purchases.findIndex((item) => item.id === purchaseId);
  if (index === -1) return null;
  const confirmed: LocalMembershipPurchase = {
    ...purchases[index],
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
  };
  purchases[index] = confirmed;
  writePurchases(purchases);
  activateLocalMembership(confirmed.planCode);
  return confirmed;
}

/** Parse a promptpay://pay? payload built by this module (or the wash flow). */
export function parseMembershipPromptPayPayload(payload?: string | null) {
  if (!payload?.startsWith('promptpay://pay?')) return null;
  const params = new URLSearchParams(payload.slice('promptpay://pay?'.length));
  return {
    recipient: params.get('recipient') ?? '',
    name: params.get('name') ?? '',
    amount: Number(params.get('amount') ?? 0),
    reference: params.get('reference') ?? '',
    note: params.get('note') ?? '',
    provider: params.get('provider') ?? 'mock_promptpay',
  };
}

// ── Slip-reading confirmation (local mock of the SlipMate verify flow) ───────
// Production reads the uploaded slip with SlipMate
// (backend/src/services/slipmate.ts) and verifies amount + recipient name + a
// transfer-time window, then confirms the payment (payment-flow.ts). Locally we
// SIMULATE the read (there is no real OCR without a backend) and run the exact
// same verify -> confirm path so the UX can be exercised end-to-end.

const USED_TRANSREF_KEY = 'roboss_membership_used_transrefs';
const THAI_BANKS = [
  'ธนาคารกสิกรไทย',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารกรุงเทพ',
  'ธนาคารกรุงไทย',
  'ธนาคารกรุงศรีอยุธยา',
];

export interface SlipReadResult {
  amount: number;
  recipientName: string;
  recipientId: string;
  transRef: string;
  transDateTime: string;
  bankName: string;
}

export interface SlipVerifyOutcome {
  ok: boolean;
  reasons: string[];
  slip: SlipReadResult;
  confirmed?: LocalMembershipPurchase | null;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function readUsedTransRefs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(USED_TRANSREF_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function markTransRefUsed(ref: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USED_TRANSREF_KEY, JSON.stringify([...new Set([...readUsedTransRefs(), ref])]));
}

/**
 * Simulate reading a payment slip (stands in for SlipMate). Returns a slip that
 * matches the purchase. A file named with "wrong"/"ผิด"/"fail" simulates a bad
 * slip (wrong amount) so the rejection path is testable.
 */
export async function readMembershipSlip(
  purchase: LocalMembershipPurchase,
  file: { name: string; size: number }
): Promise<SlipReadResult> {
  await new Promise((resolve) => setTimeout(resolve, 1100)); // pretend to OCR the image
  const simulateWrong = /wrong|ผิด|fail/i.test(file.name);
  const bankIdx = Math.abs(hashString(purchase.reference + file.name)) % THAI_BANKS.length;
  return {
    amount: simulateWrong ? purchase.amount + 100 : purchase.amount,
    recipientName: purchase.promptPayName,
    recipientId: purchase.promptPayId,
    transRef: `SLIP${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    transDateTime: new Date().toISOString(),
    bankName: THAI_BANKS[bankIdx],
  };
}

/** Verify a read slip against the purchase (amount + recipient + no reuse). */
export function verifyMembershipSlip(purchase: LocalMembershipPurchase, slip: SlipReadResult): SlipVerifyOutcome {
  const reasons: string[] = [];
  if (slip.amount !== purchase.amount) {
    reasons.push(`ยอดเงินไม่ตรง: ต้องชำระ ${purchase.amount.toLocaleString()} บาท แต่สลิประบุ ${slip.amount.toLocaleString()} บาท`);
  }
  if (slip.recipientName !== purchase.promptPayName) {
    reasons.push('ชื่อบัญชีผู้รับไม่ตรงกับบัญชีที่กำหนด');
  }
  if (readUsedTransRefs().includes(slip.transRef)) {
    reasons.push('สลิปนี้ถูกใช้ยืนยันไปแล้ว');
  }
  return { ok: reasons.length === 0, reasons, slip };
}

/** Read + verify a slip, and confirm (activate) the membership when it passes. */
export async function verifyAndConfirmMembershipSlip(
  purchaseId: string,
  file: { name: string; size: number }
): Promise<SlipVerifyOutcome> {
  const purchase = readPurchases().find((item) => item.id === purchaseId);
  if (!purchase) {
    return {
      ok: false,
      reasons: ['ไม่พบรายการซื้อนี้'],
      slip: { amount: 0, recipientName: '', recipientId: '', transRef: '', transDateTime: '', bankName: '' },
    };
  }
  const slip = await readMembershipSlip(purchase, file);
  const outcome = verifyMembershipSlip(purchase, slip);
  if (outcome.ok) {
    markTransRefUsed(slip.transRef);
    outcome.confirmed = confirmLocalMembershipPurchase(purchaseId);
  }
  return outcome;
}
