// Shared types for the ROBOSS Car Wash system

export interface User {
  id: string;
  lineUserId?: string;
  displayName: string;
  pictureUrl: string;
  phone?: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalPoints: number;
  totalWashes: number;
  memberSince: string;
  createdAt: string;
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
  ownerName?: string;
  operatingHours?: Record<string, string>;
  isActive: boolean;
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
  image: string;
}

export interface Machine {
  id: string;
  branchId?: string;
  name: string;
  type: 'car' | 'motorcycle';
  status: 'idle' | 'busy' | 'washing' | 'maintenance' | 'offline';
  espDeviceId: string;
  lastHeartbeat?: string;
  firmwareVersion?: string;
}

export interface WashSession {
  id: string;
  branchId: string;
  machineId: string;
  userId: string;
  vehicleType: 'car' | 'motorcycle';
  packageId: string;
  carSize: 'S' | 'M' | 'L';
  addons: string[];
  totalPrice: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  washStatus: 'waiting' | 'washing' | 'in_progress' | 'completed' | 'cancelled';
  currentStep: number;
  totalSteps?: number;
  progress: number;
  pointsEarned: number;
  rating: number | null;
  reviewText?: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minSpend: number;
  maxUses: number;
  usedCount: number;
  branchIds?: string[];
  validFrom: string;
  validUntil: string;
}

export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  coupon?: Coupon;
  isUsed: boolean;
  usedAt?: string;
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
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
