// Local (mock) coupon store: claim free coupons + buy purchasable coupons
// (bank-transfer + slip) without a backend. Mirrors the server coupon flow
// closely enough to demo it end-to-end at localhost.
//
// Persistence (localStorage):
//   roboss_local_claimed_coupons  -> string[] of claimed coupon codes
//   roboss_local_coupon_purchases -> LocalCouponPurchase[]
//
// The CouponPage reads getLocalCouponCards() and calls the mutating helpers when
// running without an API base URL.

export type LocalCouponPurchaseStatus =
  | 'pending_transfer'
  | 'pending_review'
  | 'confirmed'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface LocalCouponCard {
  id: string;
  title: string;
  description: string;
  discount: string;
  discountType: 'percent' | 'amount';
  minSpend: number;
  expiryDate: string;
  daysLeft: number;
  status: 'available' | 'used' | 'expired';
  code: string;
  iconId: number;
  branchIds?: string[];
  packageIds?: string[];
  source: 'claimed' | 'available';
  couponId?: string;
  isPurchasable?: boolean;
  purchasePrice?: number;
  purchaseId?: string;
  purchaseStatus?: LocalCouponPurchaseStatus;
  purchaseReference?: string;
  purchaseAmount?: number;
  transferTargetId?: string | null;
  transferTargetName?: string | null;
  slipUploadedAt?: string | null;
  expiresAt?: string | null;
}

export interface LocalCouponPurchase {
  id: string;
  couponId: string;
  branchId: string;
  amount: number;
  reference: string;
  status: LocalCouponPurchaseStatus;
  transferTargetId: string;
  transferTargetName: string;
  slipFileName: string | null;
  slipUploadedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

const CLAIMED_KEY = 'roboss_local_claimed_coupons';
const PURCHASES_KEY = 'roboss_local_coupon_purchases';
const REWARD_COUPONS_KEY = 'roboss_reward_pack_coupons';

// HQ PromptPay account that receives coupon-purchase transfers (local demo).
const COUPON_TRANSFER_ID = '0898887777';
const COUPON_TRANSFER_NAME = 'ROBOSS คูปอง (สำนักงานใหญ่)';

interface CatalogCoupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percent' | 'amount';
  discount: number;
  minSpend: number;
  validDays: number; // days from now
  iconId: number;
  isPurchasable: boolean;
  purchasePrice: number;
}

export interface RewardCouponGrant {
  rewardId: string;
  title: string;
  description: string;
  discountType: 'percent' | 'amount';
  discount: number;
  minSpend: number;
  validDays: number;
}

interface StoredRewardCoupon extends RewardCouponGrant {
  id: string;
  code: string;
  issuedAt: string;
  expiresAt: string;
}

// Local available-coupon catalog: 2 free to claim + 2 purchasable.
const CATALOG: CatalogCoupon[] = [
  {
    id: 'lc_wash20',
    code: 'WASH20',
    title: 'ส่วนลด 20% ล้างรถ',
    description: 'ใช้ได้กับทุกแพ็กเกจ ล้างรถยนต์',
    discountType: 'percent',
    discount: 20,
    minSpend: 100,
    validDays: 30,
    iconId: 12394,
    isPurchasable: false,
    purchasePrice: 0,
  },
  {
    id: 'lc_save50',
    code: 'SAVE50',
    title: 'ลดทันที 50 บาท',
    description: 'เมื่อล้างครบ 200 บาท',
    discountType: 'amount',
    discount: 50,
    minSpend: 200,
    validDays: 20,
    iconId: 12394,
    isPurchasable: false,
    purchasePrice: 0,
  },
  {
    id: 'lc_freewash',
    code: 'FREEWASH',
    title: 'คูปองล้างฟรี (มูลค่า 149฿)',
    description: 'ซื้อคูปองล้างฟรี 1 ครั้ง ราคาพิเศษ',
    discountType: 'amount',
    discount: 149,
    minSpend: 0,
    validDays: 60,
    iconId: 12394,
    isPurchasable: true,
    purchasePrice: 99,
  },
  {
    id: 'lc_triple30',
    code: 'TRIPLE30',
    title: 'แพ็กคูปอง ลด 30%',
    description: 'ซื้อคูปองส่วนลด 30% สุดคุ้ม',
    discountType: 'percent',
    discount: 30,
    minSpend: 150,
    validDays: 90,
    iconId: 12394,
    isPurchasable: true,
    purchasePrice: 199,
  },
];

// ── pub/sub ────────────────────────────────────────────────────────────────
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((cb) => cb());
}
export function listenToLocalCoupons(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ── persistence ──────────────────────────────────────────────────────────
function readClaimedCodes(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CLAIMED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function writeClaimedCodes(codes: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLAIMED_KEY, JSON.stringify([...new Set(codes)]));
  emit();
}
function readPurchases(): LocalCouponPurchase[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PURCHASES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writePurchases(purchases: LocalCouponPurchase[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
  emit();
}

function readRewardCoupons(): StoredRewardCoupon[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REWARD_COUPONS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRewardCoupons(coupons: StoredRewardCoupon[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REWARD_COUPONS_KEY, JSON.stringify(coupons.slice(0, 50)));
  emit();
}

export function grantLocalRewardCoupon(grant: RewardCouponGrant): StoredRewardCoupon {
  const issuedAt = new Date();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const coupon: StoredRewardCoupon = {
    ...grant,
    id: `reward_coupon_${issuedAt.getTime()}_${suffix}`,
    code: `PACK-${grant.rewardId.toUpperCase()}-${suffix}`,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + grant.validDays * 86400000).toISOString(),
  };
  writeRewardCoupons([coupon, ...readRewardCoupons()]);
  return coupon;
}

// ── helpers ────────────────────────────────────────────────────────────────
function validUntilFor(coupon: CatalogCoupon): string {
  return new Date(Date.now() + coupon.validDays * 86400000).toISOString();
}
function toDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}
function toDaysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
function activePurchaseByCoupon(): Map<string, LocalCouponPurchase> {
  const map = new Map<string, LocalCouponPurchase>();
  for (const purchase of readPurchases()) {
    if (['cancelled', 'expired', 'rejected'].includes(purchase.status)) continue;
    if (!map.has(purchase.couponId)) map.set(purchase.couponId, purchase);
  }
  return map;
}

/** Build the coupon cards for the customer page in local mode. */
export function getLocalCouponCards(): LocalCouponCard[] {
  const claimedCodes = new Set(readClaimedCodes());
  const purchases = activePurchaseByCoupon();

  const rewardCoupons: LocalCouponCard[] = readRewardCoupons().map((coupon) => ({
    id: coupon.id,
    couponId: coupon.rewardId,
    title: coupon.title,
    description: coupon.description,
    discount: String(coupon.discount),
    discountType: coupon.discountType,
    minSpend: coupon.minSpend,
    expiryDate: toDisplayDate(coupon.expiresAt),
    daysLeft: toDaysLeft(coupon.expiresAt),
    status: new Date(coupon.expiresAt).getTime() > Date.now() ? 'available' : 'expired',
    code: coupon.code,
    iconId: 2983,
    source: 'claimed',
  }));

  const claimed: LocalCouponCard[] = CATALOG.filter((c) => claimedCodes.has(c.code)).map((coupon) => {
    const validUntil = validUntilFor(coupon);
    return {
      id: `claimed_${coupon.id}`,
      couponId: coupon.id,
      title: coupon.title,
      description: coupon.description,
      discount: String(coupon.discount),
      discountType: coupon.discountType,
      minSpend: coupon.minSpend,
      expiryDate: toDisplayDate(validUntil),
      daysLeft: toDaysLeft(validUntil),
      status: 'available',
      code: coupon.code,
      iconId: coupon.iconId,
      source: 'claimed',
      isPurchasable: coupon.isPurchasable,
      purchasePrice: coupon.purchasePrice,
    };
  });

  const available: LocalCouponCard[] = CATALOG.filter((c) => !claimedCodes.has(c.code)).map((coupon) => {
    const validUntil = validUntilFor(coupon);
    const purchase = purchases.get(coupon.id);
    return {
      id: coupon.id,
      couponId: coupon.id,
      title: coupon.title,
      description: coupon.description,
      discount: String(coupon.discount),
      discountType: coupon.discountType,
      minSpend: coupon.minSpend,
      expiryDate: toDisplayDate(validUntil),
      daysLeft: toDaysLeft(validUntil),
      status: 'available',
      code: coupon.code,
      iconId: coupon.iconId,
      source: 'available',
      isPurchasable: coupon.isPurchasable,
      purchasePrice: coupon.purchasePrice,
      purchaseId: purchase?.id,
      purchaseStatus: purchase?.status,
      purchaseReference: purchase?.reference,
      purchaseAmount: purchase?.amount,
      transferTargetId: purchase?.transferTargetId,
      transferTargetName: purchase?.transferTargetName,
      slipUploadedAt: purchase?.slipUploadedAt,
      expiresAt: purchase?.expiresAt,
    };
  });

  return [...rewardCoupons, ...claimed, ...available];
}

function findCatalog(couponId: string): CatalogCoupon | undefined {
  return CATALOG.find((c) => c.id === couponId || c.code === couponId);
}

/** Claim a free coupon by code. */
export function claimLocalCoupon(code: string) {
  const coupon = CATALOG.find((c) => c.code === code);
  if (!coupon) throw new Error('ไม่พบคูปองนี้');
  if (coupon.isPurchasable) throw new Error('คูปองนี้ต้องซื้อ');
  writeClaimedCodes([...readClaimedCodes(), coupon.code]);
}

function buildReference(coupon: CatalogCoupon): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `RB-CPN-${coupon.code.slice(0, 6).toUpperCase()}-${stamp}-${suffix}`;
}

/** Create a pending bank-transfer purchase for a purchasable coupon. */
export function createLocalCouponPurchase(couponId: string, branchId: string): LocalCouponPurchase {
  const coupon = findCatalog(couponId);
  if (!coupon) throw new Error('ไม่พบคูปองนี้');
  if (!coupon.isPurchasable) throw new Error('คูปองนี้รับฟรีได้ ไม่ต้องซื้อ');
  const existing = activePurchaseByCoupon().get(coupon.id);
  if (existing) return existing;
  const now = new Date();
  const purchase: LocalCouponPurchase = {
    id: `cpnpur_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    couponId: coupon.id,
    branchId,
    amount: coupon.purchasePrice,
    reference: buildReference(coupon),
    status: 'pending_transfer',
    transferTargetId: COUPON_TRANSFER_ID,
    transferTargetName: COUPON_TRANSFER_NAME,
    slipFileName: null,
    slipUploadedAt: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
  };
  writePurchases([purchase, ...readPurchases()].slice(0, 50));
  return purchase;
}

/**
 * Upload a slip for a purchase. In local mode we auto-approve right away (there
 * is no admin to review) and issue the coupon into the claimed list.
 */
export function uploadLocalCouponSlip(purchaseId: string, fileName: string): LocalCouponPurchase | null {
  const purchases = readPurchases();
  const index = purchases.findIndex((p) => p.id === purchaseId);
  if (index === -1) return null;
  const now = new Date().toISOString();
  const confirmed: LocalCouponPurchase = {
    ...purchases[index],
    status: 'confirmed',
    slipFileName: fileName,
    slipUploadedAt: now,
  };
  purchases[index] = confirmed;
  writePurchases(purchases);
  const coupon = findCatalog(confirmed.couponId);
  if (coupon) writeClaimedCodes([...readClaimedCodes(), coupon.code]);
  return confirmed;
}
