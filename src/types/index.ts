// Shared types for the ROBOSS Car Wash system

export interface User {
  id: string;
  lineUserId?: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string | null;
  phone?: string | null;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalPoints: number;
  totalWashes: number;
  memberSince: string;
  createdAt: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  notificationGeneral: boolean;
  notificationWash: boolean;
  notificationCoupon: boolean;
  notificationPoints: boolean;
  locale: 'th' | 'en';
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  shortName?: string;
  address: string;
  area: string;
  type: 'car' | 'bike';
  location: { lat: number; lng: number };
  mapsUrl?: string;
  hours?: string;
  promptPayId: string;
  promptPayName: string;
  supportPhone?: string | null;
  ownershipType?: 'company_owned' | 'franchise';
  ownerName?: string;
  operatingHours?: Record<string, string>;
  isActive: boolean;
  isOpen: boolean;
  machinesFree: number;
  machinesTotal: number;
  packages: WashPackage[];
  machines: Machine[];
}

export interface WashPackage {
  id: string;
  name: string;
  description?: string;
  vehicleType: 'car' | 'motorcycle';
  prices: { S: number; M: number; L: number };
  steps: string[];
  stepDuration: number;
  features?: string[];
  isActive: boolean;
  image?: string | null;
}

export interface Machine {
  id: string;
  branchId?: string;
  code?: string;
  name: string;
  type: 'car' | 'motorcycle';
  status: 'idle' | 'reserved' | 'washing' | 'maintenance' | 'offline';
  espDeviceId: string;
  isEnabled?: boolean;
  maintenanceNote?: string | null;
  lastHeartbeat?: string;
  firmwareVersion?: string;
}

export interface Payment {
  id: string;
  sessionId: string;
  userId: string;
  branchId: string;
  method: 'promptpay' | 'cash' | 'manual';
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded' | 'expired';
  currency: string;
  amount: number;
  provider?: string | null;
  providerRef?: string | null;
  providerStatus?: string | null;
  providerConfirmedAt?: string | null;
  reference?: string | null;
  qrPayload?: string | null;
  expiresAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  refundedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  attempts?: Array<{
    id: string;
    status: string;
    source: string;
    action?: string | null;
    providerRef?: string | null;
    providerStatus?: string | null;
    eventId?: string | null;
    note?: string | null;
    attemptedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface WashSession {
  id: string;
  branchId: string;
  machineId: string;
  userId: string;
  packageId: string;
  scanTokenId?: string | null;
  scanNonce?: string | null;
  scanIssuedAt?: string | null;
  scanExpiresAt?: string | null;
  scanSource?: string | null;
  carSize: 'S' | 'M' | 'L';
  addons: string[];
  subtotalPrice?: number;
  discountAmount?: number;
  totalPrice: number;
  status: 'pending_payment' | 'payment_failed' | 'ready_to_wash' | 'in_progress' | 'completed' | 'cancelled' | 'refunded';
  currentStep: number;
  totalSteps: number;
  progress: number;
  pointsEarned: number;
  rating: number | null;
  reviewText?: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  branch?: Pick<Branch, 'id' | 'name' | 'shortName' | 'promptPayId' | 'promptPayName'>;
  machine?: Machine;
  package?: Pick<WashPackage, 'id' | 'name' | 'description' | 'vehicleType' | 'steps' | 'stepDuration' | 'image'>;
  payment?: Payment | null;
}

export interface ResolvedScan {
  qrData?: string;
  branch: Branch;
  machine: Machine;
  scan?: {
    tokenId: string;
    expiresAt: string;
    nonce: string;
  };
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description?: string;
  scope?: 'all_branches' | 'selected_branches' | 'branch_only';
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minSpend: number;
  maxUses: number;
  usedCount: number;
  isPurchasable?: boolean;
  purchasePrice?: number;
  branchIds?: string[];
  packageIds?: string[];
  validFrom: string;
  validUntil: string;
}

export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  coupon?: Coupon;
  isUsed: boolean;
  status?: 'claimed' | 'redeemed' | 'expired' | 'cancelled';
  usedAt?: string;
}

export interface CouponPurchase {
  id: string;
  userId: string;
  couponId: string;
  branchId: string;
  issuedUserCouponId?: string | null;
  status: 'pending_transfer' | 'pending_review' | 'confirmed' | 'rejected' | 'expired' | 'cancelled';
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string;
  transferTargetId?: string | null;
  transferTargetName?: string | null;
  slipUploadedAt?: string | null;
  customerNote?: string | null;
  adminNote?: string | null;
  confirmedAt?: string | null;
  rejectedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  coupon?: Coupon | null;
  branch?: {
    id: string;
    code: string;
    name: string;
    shortName?: string | null;
    promptPayId?: string | null;
    promptPayName?: string | null;
  } | null;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  sessionId?: string;
  type: 'earn' | 'redeem' | 'expire' | 'bonus';
  amount: number;
  description: string;
  createdAt: string;
}

export interface Stamp {
  id: string;
  userId: string;
  currentCount: number;
  targetCount: number;
  rewardClaimed: boolean;
  lastStampAt?: string;
}

export interface StampTransaction {
  id: string;
  stampId: string;
  sessionId: string;
  branchId: string;
  packageId: string;
  stampCount: number;
  rawStampCount: number;
  reason: 'wash_completed' | 'stamp_card_full' | 'free_wash_no_stamp' | string;
  metadata?: Record<string, unknown> | null;
  voidedAt?: string | null;
  createdAt: string;
}

export interface MembershipPlan {
  id: string;
  code: string;
  name: string;
  headline?: string;
  description?: string | null;
  price: number;
  currency: string;
  washLimit: number;
  grapheneLimit: number;
  freeVacuumPerVisit: boolean;
  vipFastLane: boolean;
  group?: 'best_seller' | 'membership' | 'bundle' | 'motorcycle' | string;
  groupLabel?: string;
  termLabel?: string;
  badge?: string;
  sortOrder?: number;
  active?: boolean;
  membership?: UserMembership | null;
  benefits?: MembershipBenefit[];
}

export interface UserMembership {
  id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  washUsed: number;
  grapheneUsed: number;
  washRemaining: number;
  grapheneRemaining: number;
  paymentAmount: number;
  paymentCurrency: string;
  paymentStatus: string;
  paymentReference?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  cancelledAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipBenefit {
  key: 'washes' | 'graphene_shield' | 'free_vacuum' | 'vip_fast_lane' | string;
  title: string;
  description: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  enabled: boolean;
}

export interface MembershipOverview {
  plan: MembershipPlan;
  membership: UserMembership | null;
  active: boolean;
  benefits: MembershipBenefit[];
  plans?: MembershipPlan[];
  memberships?: UserMembership[];
  groups?: Array<{ key: string; label: string; description: string }>;
  promoPlaybook?: {
    traffic: string[];
    profit: string[];
    margin: string[];
    loyalty: string[];
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: 'wash' | 'coupon' | 'points' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'hq' | 'franchise_owner' | 'branch_manager';
  branchIds: string[];
  isActive: boolean;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationsResponse extends PaginatedResponse<Notification> {
  unreadCount: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface Reward {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  points: number;
  category: string;
  tag?: string | null;
  icon: string;
  iconBg?: string | null;
  stock?: number | null;
  branchIds?: string[];
}

export interface AuthConfig {
  devLoginEnabled: boolean;
  lineLoginEnabled: boolean;
  clerkEnabled?: boolean;
  customerAuthMode?: 'mock' | 'legacy' | 'clerk';
}

export interface Vehicle {
  id: string;
  userId: string;
  brand: string;
  model: string;
  plate: string;
  province: string;
  color: string;
  size: 'S' | 'M' | 'L';
  createdAt: string;
}

export interface Promotion {
  id: string;
  title: string;
  description?: string;
  image?: string;
  branchIds: string[];
  gradient?: string;
  conditions?: string;
  validFrom: string;
  validUntil: string;
}
