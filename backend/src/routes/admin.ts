import {
  AdminBranchScope,
  CouponPaymentAccountType,
  CouponPurchaseStatus,
  CouponScope,
  CouponStatus,
  DiscountType,
  MachineStatus,
  PaymentStatus,
  Prisma,
  WashSessionStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  getAdminWithScopes,
  getBranchWhereClause,
  getMachineBranchFilter,
  getPaymentBranchFilter,
  getScopedBranchIds,
  getSessionBranchFilter,
} from '../lib/admin-scope.js';
import { getRuntimeConfig } from '../lib/config.js';
import { signAdminAccessToken, signAdminRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { AppEnv } from '../lib/types.js';
import { requireAdmin } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rate-limit.js';
import {
  buildBranchPaymentConfigSummary,
  encryptBranchPaymentCredential,
  maskCredentialValue,
} from '../services/branch-payment-config.js';
import { handleMachineEvent } from '../services/machine-events.js';
import { publishMachineCommand } from '../services/mqtt.js';
import { reconcilePayment } from '../services/payment-flow.js';
import { STAMP_TARGET_COUNT } from '../services/stamp-rules.js';

export const adminRoutes = new Hono<AppEnv>();
const runtimeConfig = getRuntimeConfig();
const adminAuthRateLimit = createRateLimitMiddleware({
  bucket: 'admin-auth',
  windowMs: runtimeConfig.authRateLimitWindowMs,
  max: Math.max(5, Math.floor(runtimeConfig.authRateLimitMax / 2)),
});

const machineStatuses: MachineStatus[] = ['idle', 'reserved', 'washing', 'maintenance', 'offline'];
const sessionStatuses: WashSessionStatus[] = [
  'pending_payment',
  'payment_failed',
  'ready_to_wash',
  'in_progress',
  'completed',
  'cancelled',
  'refunded',
];
const paymentStatuses: PaymentStatus[] = ['pending', 'confirmed', 'failed', 'cancelled', 'refunded', 'expired'];

type AdminWithScopes = NonNullable<Awaited<ReturnType<typeof getAdminWithScopes>>>;

const branchSettingsSchema = z
  .object({
    timezone: z.string().min(1).optional(),
    currency: z.string().min(1).optional(),
    locale: z.string().min(1).optional(),
    pointsEarnRate: z.number().int().min(0).optional(),
    pointsMinSpend: z.number().int().min(0).optional(),
    allowsPointRedemption: z.boolean().optional(),
    receiptFooter: z.string().nullable().optional(),
    supportPhone: z.string().nullable().optional(),
    maxConcurrentSessions: z.number().int().min(1).optional(),
    washStartGraceMinutes: z.number().int().min(0).optional(),
  })
  .strict();

const branchScopeInputSchema = z.object({
  branchId: z.string().min(1),
  canViewRevenue: z.boolean().default(true),
  canManageMachines: z.boolean().default(true),
  canManageCoupons: z.boolean().default(true),
});

const stampAdjustmentSchema = z
  .object({
    delta: z.number().int().min(-10).max(10),
    reason: z.string().trim().min(8).max(300),
  })
  .strict()
  .refine((payload) => payload.delta !== 0, {
    message: 'Stamp adjustment must not be zero',
    path: ['delta'],
  });

const cashierPaymentSchema = z
  .object({
    branchId: z.string().min(1),
    machineId: z.string().min(1),
    packageId: z.string().min(1),
    carSize: z.enum(['S', 'M', 'L']).default('M'),
    amount: z.number().int().positive(),
    paymentMethod: z.enum(['cash', 'manual']).default('cash'),
    customerName: z.string().trim().max(120).optional(),
    customerPhone: z.string().trim().max(40).optional(),
    lineUserId: z.string().trim().max(120).optional(),
    receiptImage: z.string().max(1_500_000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

const createBranchSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  shortName: z.string().min(1).nullable().optional(),
  address: z.string().min(1),
  area: z.string().min(1),
  type: z.string().min(1).default('car'),
  ownershipType: z.enum(['company_owned', 'franchise']).default('franchise'),
  franchiseCode: z.string().nullable().optional(),
  lat: z.number(),
  lng: z.number(),
  promptPayId: z.string().min(1),
  promptPayName: z.string().min(1),
  ownerName: z.string().nullable().optional(),
  mapsUrl: z.string().nullable().optional(),
  hours: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  settings: branchSettingsSchema.optional(),
});

const updateBranchSchema = createBranchSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one branch field is required'
);

const createAdminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['hq_admin', 'branch_admin']),
  branchIds: z.array(z.string()).optional(),
  branchScopes: z.array(branchScopeInputSchema).optional(),
});

const updateAdminUserSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    name: z.string().min(1).optional(),
    role: z.enum(['hq_admin', 'branch_admin']).optional(),
    isActive: z.boolean().optional(),
    branchScopes: z.array(branchScopeInputSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one user field is required');

const packageBaseSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  vehicleType: z.string().min(1).default('car'),
  priceS: z.number().int().min(0),
  priceM: z.number().int().min(0),
  priceL: z.number().int().min(0),
  steps: z.array(z.string().min(1)).min(1),
  stepDuration: z.number().int().min(1).default(300),
  features: z.unknown().nullable().optional(),
  image: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const createPackageSchema = packageBaseSchema;
const updatePackageSchema = packageBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one package field is required');

const packageActivationSchema = z.object({
  isActive: z.boolean(),
});

const branchPackageConfigSchema = z
  .object({
    isActive: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    displayName: z.string().nullable().optional(),
    descriptionOverride: z.string().nullable().optional(),
    priceOverrideS: z.number().int().min(0).nullable().optional(),
    priceOverrideM: z.number().int().min(0).nullable().optional(),
    priceOverrideL: z.number().int().min(0).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one branch package field is required');

const branchPaymentCapabilitySchema = z
  .object({
    supportsWebhook: z.boolean().optional(),
    supportsPolling: z.boolean().optional(),
    supportsDynamicQr: z.boolean().optional(),
    supportsReferenceBinding: z.boolean().optional(),
    supportsRefund: z.boolean().optional(),
    supportsSliplessConfirmation: z.boolean().optional(),
  })
  .optional();

const branchPaymentCredentialInputSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  isSecret: z.boolean().optional(),
});

const createBranchPaymentConfigSchema = z.object({
  branchId: z.string().min(1),
  mode: z.enum(['hq_managed', 'branch_managed', 'manual_promptpay']),
  provider: z.enum(['promptpay_manual', 'opn', 'stripe', 'bank_qr', 'ksher', 'custom']),
  isActive: z.boolean().optional(),
  displayName: z.string().min(1),
  statementName: z.string().nullable().optional(),
  settlementOwnerType: z.enum(['hq', 'franchisee']).optional(),
  credentials: z.array(branchPaymentCredentialInputSchema).default([]),
  capabilities: branchPaymentCapabilitySchema,
});

const updateBranchPaymentConfigSchema = z
  .object({
    mode: z.enum(['hq_managed', 'branch_managed', 'manual_promptpay']).optional(),
    provider: z.enum(['promptpay_manual', 'opn', 'stripe', 'bank_qr', 'ksher', 'custom']).optional(),
    isActive: z.boolean().optional(),
    displayName: z.string().min(1).optional(),
    statementName: z.string().nullable().optional(),
    settlementOwnerType: z.enum(['hq', 'franchisee']).optional(),
    credentials: z.array(branchPaymentCredentialInputSchema).optional(),
    capabilities: branchPaymentCapabilitySchema,
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one payment config field is required');

const branchPaymentActivationSchema = z.object({
  isActive: z.boolean(),
});

const paymentConfigGovernanceSchema = z
  .object({
    isLocked: z.boolean().optional(),
    approvalStatus: z.enum(['draft', 'pending_review', 'approved', 'rejected']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one governance field is required');

const couponBaseObjectSchema = z.object({
  code: z.string().min(2),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  scope: z.enum(['all_branches', 'selected_branches', 'branch_only']),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number().int().min(1),
  minSpend: z.number().int().min(0).default(0),
  maxUses: z.number().int().min(0).default(0),
  maxUsesPerUser: z.number().int().min(0).default(1),
  isPurchasable: z.boolean().default(false),
  purchasePrice: z.number().int().min(0).default(0),
  packageIds: z.array(z.string().min(1)).default([]),
  branchIds: z.array(z.string().min(1)).default([]),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

function validateCouponDates(
  value: { validFrom?: Date; validUntil?: Date; discountType?: DiscountType; discountValue?: number },
  ctx: z.RefinementCtx
) {
  if (value.validFrom && value.validUntil && value.validUntil <= value.validFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validUntil must be later than validFrom',
      path: ['validUntil'],
    });
  }

  if (value.discountType === 'percent' && typeof value.discountValue === 'number' && value.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percent discount cannot exceed 100',
      path: ['discountValue'],
    });
  }

  if ('isPurchasable' in value && value.isPurchasable && (value as any).purchasePrice <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Purchasable coupons require a purchase price',
      path: ['purchasePrice'],
    });
  }
}

const createCouponSchema = couponBaseObjectSchema.superRefine((value, ctx) => {
  validateCouponDates(value, ctx);
});

const updateCouponSchema = couponBaseObjectSchema
  .partial()
  .superRefine((value, ctx) => {
    validateCouponDates(value, ctx);
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one coupon field is required');

const couponActivationSchema = z.object({
  isActive: z.boolean(),
});

const couponPurchaseDecisionSchema = z
  .object({
    adminNote: z.string().trim().max(500).optional(),
    amountMatches: z.boolean().optional(),
    referenceMatches: z.boolean().optional(),
    accountMatches: z.boolean().optional(),
  })
  .strict();

const couponPaymentAccountSchema = z
  .object({
    code: z.string().trim().min(2).max(60).optional(),
    displayName: z.string().trim().min(2).max(120),
    accountType: z.enum(['hq', 'branch']).default('hq'),
    branchId: z.string().min(1).nullable().optional(),
    promptPayId: z.string().trim().min(1).max(80),
    promptPayName: z.string().trim().min(1).max(160),
    bankName: z.string().trim().max(120).nullable().optional(),
    accountName: z.string().trim().max(160).nullable().optional(),
    accountNumber: z.string().trim().max(80).nullable().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

const updateCouponPaymentAccountSchema = couponPaymentAccountSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one payment account field is required');

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfLookbackDays(days: number) {
  const value = startOfDay();
  value.setDate(value.getDate() - (days - 1));
  return value;
}

function rangeStartFrom(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() - days);
  return value;
}

function getBangkokDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function buildRevenueDateKeys(start: Date, days: number) {
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return getBangkokDateKey(date);
  });
}

function getPaymentSalesDate(payment: {
  confirmedAt?: Date | null;
  providerConfirmedAt?: Date | null;
  createdAt: Date;
}) {
  return payment.confirmedAt ?? payment.providerConfirmedAt ?? payment.createdAt;
}

function mapScopePermissions(
  scope: AdminBranchScope & { branch?: { id: string; name: string; code: string } | null }
) {
  return {
    branchId: scope.branchId,
    canViewRevenue: scope.canViewRevenue,
    canManageMachines: scope.canManageMachines,
    canManageCoupons: scope.canManageCoupons,
    branch: scope.branch
      ? {
          id: scope.branch.id,
          name: scope.branch.name,
          code: scope.branch.code,
        }
      : null,
  };
}

function mapAdminIdentity(admin: AdminWithScopes) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
    branchIds: getScopedBranchIds(admin.role, admin.branchScopes),
    scopes: admin.branchScopes.map((scope) => mapScopePermissions(scope)),
  };
}

function mapBranchSettings(
  settings:
    | {
        timezone: string;
        currency: string;
        locale: string;
        pointsEarnRate: number;
        pointsMinSpend: number;
        allowsPointRedemption: boolean;
        receiptFooter: string | null;
        supportPhone: string | null;
        maxConcurrentSessions: number;
        washStartGraceMinutes: number;
      }
    | null
    | undefined
) {
  if (!settings) {
    return null;
  }

  return {
    timezone: settings.timezone,
    currency: settings.currency,
    locale: settings.locale,
    pointsEarnRate: settings.pointsEarnRate,
    pointsMinSpend: settings.pointsMinSpend,
    allowsPointRedemption: settings.allowsPointRedemption,
    receiptFooter: settings.receiptFooter,
    supportPhone: settings.supportPhone,
    maxConcurrentSessions: settings.maxConcurrentSessions,
    washStartGraceMinutes: settings.washStartGraceMinutes,
  };
}

type AdminPackageRecord = Prisma.WashPackageGetPayload<{
  include: {
    branchConfigs: {
      include: {
        branch: {
          select: {
            id: true;
            code: true;
            name: true;
            shortName: true;
            isActive: true;
          };
        };
      };
    };
  };
}>;

function mapBranchPackageConfig(config: AdminPackageRecord['branchConfigs'][number], pkg: AdminPackageRecord) {
  return {
    id: config.id,
    branchId: config.branchId,
    isActive: config.isActive,
    isVisible: config.isVisible,
    displayName: config.displayName,
    descriptionOverride: config.descriptionOverride,
    priceOverrides: {
      S: config.priceOverrideS,
      M: config.priceOverrideM,
      L: config.priceOverrideL,
    },
    effectivePrices: {
      S: config.priceOverrideS ?? pkg.priceS,
      M: config.priceOverrideM ?? pkg.priceM,
      L: config.priceOverrideL ?? pkg.priceL,
    },
    branch: config.branch,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function mapAdminPackage(pkg: AdminPackageRecord) {
  const branchConfigs = pkg.branchConfigs.map((config) => mapBranchPackageConfig(config, pkg));

  return {
    id: pkg.id,
    code: pkg.code,
    name: pkg.name,
    description: pkg.description,
    vehicleType: pkg.vehicleType,
    prices: {
      S: pkg.priceS,
      M: pkg.priceM,
      L: pkg.priceL,
    },
    steps: Array.isArray(pkg.steps) ? pkg.steps : [],
    stepDuration: pkg.stepDuration,
    features: pkg.features,
    image: pkg.image,
    sortOrder: pkg.sortOrder,
    isActive: pkg.isActive,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
    branchConfigs,
    branchConfigStats: {
      total: branchConfigs.length,
      active: branchConfigs.filter((config) => config.isActive).length,
      visible: branchConfigs.filter((config) => config.isVisible).length,
      overriddenPricing: branchConfigs.filter(
        (config) =>
          config.priceOverrides.S !== null || config.priceOverrides.M !== null || config.priceOverrides.L !== null
      ).length,
    },
  };
}

type AdminCouponRecord = Prisma.CouponGetPayload<{
  include: {
    branches: {
      include: {
        branch: {
          select: {
            id: true;
            code: true;
            name: true;
            shortName: true;
            isActive: true;
          };
        };
      };
    };
    _count: {
      select: {
        users: true;
        redemptions: true;
      };
    };
  };
}>;

type AdminCouponPurchaseRecord = Prisma.CouponPurchaseGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        displayName: true;
        phone: true;
        lineUserId: true;
        avatarUrl: true;
      };
    };
    branch: {
      select: {
        id: true;
        code: true;
        name: true;
        shortName: true;
        promptPayId: true;
        promptPayName: true;
      };
    };
    paymentAccount: {
      select: {
        id: true;
        code: true;
        displayName: true;
        accountType: true;
        branchId: true;
        promptPayId: true;
        promptPayName: true;
        bankName: true;
        accountName: true;
        accountNumber: true;
        isActive: true;
        isDefault: true;
      };
    };
    coupon: {
      include: {
        branches: {
          select: {
            branchId: true;
          };
        };
      };
    };
    issuedUserCoupon: {
      select: {
        id: true;
        status: true;
        claimedAt: true;
        redeemedAt: true;
      };
    };
  };
}>;

type AdminCouponPaymentAccountRecord = Prisma.CouponPaymentAccountGetPayload<{
  include: {
    branch: {
      select: {
        id: true;
        code: true;
        name: true;
        shortName: true;
        isActive: true;
      };
    };
    _count: {
      select: {
        purchases: true;
      };
    };
  };
}>;

type AdminBranchPaymentConfigRecord = {
  id: string;
  branchId: string;
  mode: 'hq_managed' | 'branch_managed' | 'manual_promptpay';
  provider: 'promptpay_manual' | 'opn' | 'stripe' | 'bank_qr' | 'ksher' | 'custom';
  isActive: boolean;
  isLocked: boolean;
  approvalStatus: 'draft' | 'pending_review' | 'approved' | 'rejected';
  approvedAt: Date | null;
  approvedByAdminId: string | null;
  displayName: string;
  statementName: string | null;
  settlementOwnerType: 'hq' | 'franchisee';
  createdAt: Date;
  updatedAt: Date;
  branch: {
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    isActive: boolean;
  };
  credentials: Array<{
    id: string;
    key: string;
    valueEncrypted: string;
    maskedValue: string | null;
    isSecret: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  capabilities: {
    supportsWebhook: boolean;
    supportsPolling: boolean;
    supportsDynamicQr: boolean;
    supportsReferenceBinding: boolean;
    supportsRefund: boolean;
    supportsSliplessConfirmation: boolean;
  } | null;
};

type AdminAuditLogRecord = Prisma.AuditLogGetPayload<{
  include: {
    adminUser: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
  };
}>;

function mapAdminCoupon(coupon: AdminCouponRecord, redemptionSummary: Record<string, { branchId: string; usedCount: number }[]>) {
  const assignedBranches = coupon.branches.map((item) => ({
    id: item.branch.id,
    code: item.branch.code,
    name: item.branch.name,
    shortName: item.branch.shortName,
    isActive: item.branch.isActive,
  }));

  const remainingUses = coupon.maxUses > 0 ? Math.max(coupon.maxUses - coupon.usedCount, 0) : null;

  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    description: coupon.description,
    scope: coupon.scope,
    status: coupon.status,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minSpend: coupon.minSpend,
    maxUses: coupon.maxUses,
    maxUsesPerUser: coupon.maxUsesPerUser,
    usedCount: coupon.usedCount,
    isPurchasable: coupon.isPurchasable,
    purchasePrice: coupon.purchasePrice,
    packageIds: coupon.packageIds,
    branchIds: assignedBranches.map((branch) => branch.id),
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
    branches: assignedBranches,
    usage: {
      claimedCount: coupon._count.users,
      redemptionCount: coupon._count.redemptions,
      usedCount: coupon.usedCount,
      remainingUses,
      branchUsage: redemptionSummary[coupon.id] ?? [],
    },
  };
}

function mapAdminCouponPurchase(purchase: AdminCouponPurchaseRecord) {
  return {
    id: purchase.id,
    userId: purchase.userId,
    couponId: purchase.couponId,
    branchId: purchase.branchId,
    issuedUserCouponId: purchase.issuedUserCouponId,
    status: purchase.status,
    amount: purchase.amount,
    currency: purchase.currency,
    paymentMethod: purchase.paymentMethod,
    reference: purchase.reference,
    transferTargetId: purchase.transferTargetId,
    transferTargetName: purchase.transferTargetName,
    slipImage: purchase.slipImage,
    slipImageHash: purchase.slipImageHash ? purchase.slipImageHash.slice(0, 12) : null,
    slipFileName: purchase.slipFileName,
    slipMimeType: purchase.slipMimeType,
    slipUploadedAt: purchase.slipUploadedAt?.toISOString() ?? null,
    customerNote: purchase.customerNote,
    adminNote: purchase.adminNote,
    reviewedByAdminId: purchase.reviewedByAdminId,
    reviewChecklist: purchase.reviewChecklist,
    confirmedAt: purchase.confirmedAt?.toISOString() ?? null,
    rejectedAt: purchase.rejectedAt?.toISOString() ?? null,
    expiresAt: purchase.expiresAt?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    user: purchase.user,
    branch: purchase.branch,
    paymentAccount: purchase.paymentAccount,
    issuedUserCoupon: purchase.issuedUserCoupon
      ? {
          ...purchase.issuedUserCoupon,
          claimedAt: purchase.issuedUserCoupon.claimedAt.toISOString(),
          redeemedAt: purchase.issuedUserCoupon.redeemedAt?.toISOString() ?? null,
        }
      : null,
    coupon: {
      id: purchase.coupon.id,
      code: purchase.coupon.code,
      title: purchase.coupon.title,
      description: purchase.coupon.description,
      scope: purchase.coupon.scope,
      status: purchase.coupon.status,
      discountType: purchase.coupon.discountType,
      discountValue: purchase.coupon.discountValue,
      minSpend: purchase.coupon.minSpend,
      maxUses: purchase.coupon.maxUses,
      usedCount: purchase.coupon.usedCount,
      isPurchasable: purchase.coupon.isPurchasable,
      purchasePrice: purchase.coupon.purchasePrice,
      branchIds: purchase.coupon.branches.map((branch) => branch.branchId),
      packageIds: purchase.coupon.packageIds,
      validFrom: purchase.coupon.validFrom.toISOString(),
      validUntil: purchase.coupon.validUntil.toISOString(),
    },
  };
}

function mapAdminCouponPaymentAccount(account: AdminCouponPaymentAccountRecord) {
  return {
    id: account.id,
    code: account.code,
    displayName: account.displayName,
    accountType: account.accountType,
    branchId: account.branchId,
    promptPayId: account.promptPayId,
    promptPayName: account.promptPayName,
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    isActive: account.isActive,
    isDefault: account.isDefault,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    branch: account.branch,
    purchaseCount: account._count.purchases,
  };
}

const adminCouponPurchaseInclude = {
  user: {
    select: {
      id: true,
      displayName: true,
      phone: true,
      lineUserId: true,
      avatarUrl: true,
    },
  },
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
      shortName: true,
      promptPayId: true,
      promptPayName: true,
    },
  },
  paymentAccount: {
    select: {
      id: true,
      code: true,
      displayName: true,
      accountType: true,
      branchId: true,
      promptPayId: true,
      promptPayName: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
      isActive: true,
      isDefault: true,
    },
  },
  coupon: {
    include: {
      branches: {
        select: {
          branchId: true,
        },
      },
    },
  },
  issuedUserCoupon: {
    select: {
      id: true,
      status: true,
      claimedAt: true,
      redeemedAt: true,
    },
  },
} as const;

function mapAdminBranchPaymentConfig(config: AdminBranchPaymentConfigRecord) {
  return {
    ...buildBranchPaymentConfigSummary(config),
    branch: {
      id: config.branch.id,
      code: config.branch.code,
      name: config.branch.name,
      shortName: config.branch.shortName,
      isActive: config.branch.isActive,
    },
  };
}

function buildPaymentConfigReadiness(config: AdminBranchPaymentConfigRecord | null) {
  const promptPayId = config?.credentials.find((credential) => credential.key === 'promptpay_id')?.maskedValue ?? null;
  const promptPayName =
    config?.credentials.find((credential) => credential.key === 'promptpay_name')?.maskedValue ?? null;
  const supportsReferenceBinding = config?.capabilities?.supportsReferenceBinding ?? false;
  const supportsSliplessConfirmation = config?.capabilities?.supportsSliplessConfirmation ?? false;

  return {
    hasConfig: Boolean(config),
    hasPromptPayId: Boolean(promptPayId),
    hasPromptPayName: Boolean(promptPayName),
    isActive: config?.isActive ?? false,
    supportsReferenceBinding,
    supportsSliplessConfirmation,
    ready:
      Boolean(config) &&
      Boolean(promptPayId) &&
      Boolean(promptPayName) &&
      Boolean(config?.isActive) &&
      supportsReferenceBinding,
  };
}

function mapPaymentConfigGovernanceOverview(config: AdminBranchPaymentConfigRecord) {
  return {
    config: mapAdminBranchPaymentConfig(config),
    readiness: buildPaymentConfigReadiness(config),
  };
}

function mapAuditLogRecord(record: AdminAuditLogRecord) {
  return {
    id: record.id,
    actorType: record.actorType,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    branchId: record.branchId,
    metadata: record.metadata,
    createdAt: record.createdAt,
    adminUser: record.adminUser
      ? {
          id: record.adminUser.id,
          name: record.adminUser.name,
          email: record.adminUser.email,
          role: record.adminUser.role,
        }
      : null,
  };
}

function toNullableJsonInput(
  value: unknown | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

async function logAdminAction(params: {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: 'admin',
      adminUserId: params.adminUserId,
      branchId: params.branchId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata,
    },
  });
}

async function logSystemAction(params: {
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: 'system',
      branchId: params.branchId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata,
    },
  });
}

function normalizeBranchScopes(input: {
  role: 'hq_admin' | 'branch_admin';
  branchIds?: string[];
  branchScopes?: Array<z.infer<typeof branchScopeInputSchema>>;
}) {
  if (input.role === 'hq_admin') {
    return [];
  }

  if (input.branchScopes?.length) {
    return input.branchScopes;
  }

  return (input.branchIds ?? []).map((branchId) => ({
    branchId,
    canViewRevenue: true,
    canManageMachines: true,
    canManageCoupons: true,
  }));
}

function ensureBranchAccess(admin: AdminWithScopes, branchId?: string | null) {
  if (!branchId) {
    return null;
  }

  if (admin.role === 'hq_admin') {
    return branchId;
  }

  if (!admin.branchScopes.some((scope) => scope.branchId === branchId)) {
    throw new Error('Branch access denied');
  }

  return branchId;
}

function ensureHqRole(admin: AdminWithScopes) {
  if (admin.role !== 'hq_admin') {
    throw new Error('Only HQ can manage global packages');
  }
}

function ensurePaymentConfigEditable(admin: AdminWithScopes, config: { isLocked: boolean }) {
  if (config.isLocked && admin.role !== 'hq_admin') {
    throw new Error('This payment config is locked by HQ');
  }
}

function ensureCouponManagementAccess(admin: AdminWithScopes, branchId?: string | null) {
  if (admin.role === 'hq_admin') {
    return branchId ?? null;
  }

  if (!branchId) {
    return null;
  }

  const scope = admin.branchScopes.find((item) => item.branchId === branchId);
  if (!scope || !scope.canManageCoupons) {
    throw new Error('Coupon management access denied');
  }

  return branchId;
}

function getCouponManageableBranchIds(admin: AdminWithScopes) {
  if (admin.role === 'hq_admin') {
    return null;
  }

  return admin.branchScopes.filter((scope) => scope.canManageCoupons).map((scope) => scope.branchId);
}

function canManageCouponRecord(
  admin: AdminWithScopes,
  coupon: { scope: CouponScope; branches: Array<{ branchId: string }> }
) {
  if (admin.role === 'hq_admin') {
    return true;
  }

  const allowedBranchIds = getCouponManageableBranchIds(admin) ?? [];
  if (coupon.scope === 'all_branches') {
    return false;
  }

  if (coupon.scope === 'branch_only' && coupon.branches.length !== 1) {
    return false;
  }

  if (coupon.branches.length === 0) {
    return false;
  }

  return coupon.branches.every((branch) => allowedBranchIds.includes(branch.branchId));
}

function canManageCouponPurchaseRecord(
  admin: AdminWithScopes,
  purchase: { branchId: string; coupon: { scope: CouponScope; branches: Array<{ branchId: string }> } }
) {
  if (admin.role === 'hq_admin') {
    return true;
  }

  const scope = admin.branchScopes.find((item) => item.branchId === purchase.branchId);
  if (!scope?.canManageCoupons) {
    return false;
  }

  if (purchase.coupon.scope === 'all_branches') {
    return true;
  }

  return purchase.coupon.branches.some((branch) => branch.branchId === purchase.branchId);
}

function canManageCouponPaymentAccount(
  admin: AdminWithScopes,
  account: { accountType: CouponPaymentAccountType; branchId: string | null }
) {
  if (admin.role === 'hq_admin') {
    return true;
  }

  if (account.accountType === 'hq') {
    return false;
  }

  if (!account.branchId) {
    return false;
  }

  const scope = admin.branchScopes.find((item) => item.branchId === account.branchId);
  return Boolean(scope?.canManageCoupons);
}

function resolveCouponPaymentAccountBranch(admin: AdminWithScopes, accountType: CouponPaymentAccountType, branchId?: string | null) {
  if (accountType === 'hq') {
    if (admin.role !== 'hq_admin') {
      throw new Error('Only HQ can manage central coupon payment accounts');
    }
    return null;
  }

  if (!branchId) {
    throw new Error('Branch payment accounts require branchId');
  }

  ensureCouponManagementAccess(admin, branchId);
  return branchId;
}

function buildCouponPaymentAccountCode(accountType: CouponPaymentAccountType, branchId: string | null, displayName: string) {
  const scope = accountType === 'hq' ? 'HQ' : branchId?.slice(0, 8).toUpperCase() ?? 'BRANCH';
  const slug = displayName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 24)
    .toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CPA-${scope}-${slug || 'ACCOUNT'}-${suffix}`;
}

async function validateCouponReferences(params: {
  packageIds?: string[];
  branchIds?: string[];
}) {
  if (params.packageIds?.length) {
    const packages = await prisma.washPackage.findMany({
      where: { id: { in: params.packageIds } },
      select: { id: true },
    });

    if (packages.length !== new Set(params.packageIds).size) {
      throw new Error('One or more packages were not found');
    }
  }

  if (params.branchIds?.length) {
    const branches = await prisma.branch.findMany({
      where: { id: { in: params.branchIds } },
      select: { id: true },
    });

    if (branches.length !== new Set(params.branchIds).size) {
      throw new Error('One or more branches were not found');
    }
  }
}

function resolveCouponBranchAssignments(
  admin: AdminWithScopes,
  scope: CouponScope,
  branchIds: string[] | undefined
) {
  const normalizedBranchIds = Array.from(new Set((branchIds ?? []).filter(Boolean)));
  const allowedBranchIds = getCouponManageableBranchIds(admin);

  if (scope === 'all_branches') {
    if (admin.role !== 'hq_admin') {
      throw new Error('Only HQ can create all-branch coupons');
    }
    return [];
  }

  if (allowedBranchIds && normalizedBranchIds.some((branchId) => !allowedBranchIds.includes(branchId))) {
    throw new Error('Coupon branch assignment is outside admin scope');
  }

  if (scope === 'branch_only') {
    if (normalizedBranchIds.length !== 1) {
      throw new Error('Branch-only coupons must be assigned to exactly one branch');
    }
    return normalizedBranchIds;
  }

  if (scope === 'selected_branches') {
    if (normalizedBranchIds.length === 0) {
      throw new Error('Selected-branch coupons require at least one branch');
    }
    return normalizedBranchIds;
  }

  return normalizedBranchIds;
}

function buildCashierReference() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CASH-${Date.now()}-${suffix}`;
}

function parseJsonArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function includesText(value: string | null | undefined, pattern: string) {
  return (value ?? '').toLowerCase().includes(pattern);
}

function buildServiceTasks(session: {
  status: WashSessionStatus;
  addons: Prisma.JsonValue;
  package: { code?: string | null; name: string; steps?: Prisma.JsonValue | null };
  payment?: { status: PaymentStatus } | null;
  user?: {
    memberships?: Array<{
      status: string;
      washUsed: number;
      grapheneUsed: number;
      plan: {
        code: string;
        name?: string | null;
        washLimit: number;
        grapheneLimit: number;
        freeVacuumPerVisit: boolean;
        vipFastLane: boolean;
      };
    }>;
  };
}) {
  const activeMembership =
    session.user?.memberships
      ?.filter((membership) => membership.status === 'active')
      .sort((a, b) => {
        const aScore =
          (a.plan.vipFastLane ? 100 : 0) +
          (a.plan.freeVacuumPerVisit ? 50 : 0) +
          Math.max(a.plan.washLimit - a.washUsed, 0) +
          Math.max(a.plan.grapheneLimit - a.grapheneUsed, 0);
        const bScore =
          (b.plan.vipFastLane ? 100 : 0) +
          (b.plan.freeVacuumPerVisit ? 50 : 0) +
          Math.max(b.plan.washLimit - b.washUsed, 0) +
          Math.max(b.plan.grapheneLimit - b.grapheneUsed, 0);
        return bScore - aScore;
      })[0] ?? null;
  const steps = parseJsonArray(session.package.steps);
  const addons = parseJsonArray(session.addons);
  const packageText = `${session.package.code ?? ''} ${session.package.name}`;
  const needsGraphene = includesText(packageText, 'graphene');
  const hasVacuumAddon = addons.some((addon) => includesText(String(addon), 'vacuum'));
  const membershipHasWashCredit = Boolean(activeMembership && activeMembership.washUsed < activeMembership.plan.washLimit);
  const membershipHasGrapheneCredit = Boolean(
    activeMembership && activeMembership.grapheneUsed < activeMembership.plan.grapheneLimit
  );
  const isPendingPayment = session.status === 'pending_payment' || session.payment?.status === 'pending';
  const isCompleted = session.status === 'completed';
  const isInProgress = session.status === 'in_progress';

  const tasks = [
    {
      key: 'payment',
      title: isPendingPayment ? 'รอลูกค้าชำระเงิน' : 'ยืนยันการชำระเงินแล้ว',
      detail: session.payment?.status ? `Payment: ${session.payment.status}` : 'ยังไม่มี payment record',
      status: isPendingPayment ? 'waiting' : 'done',
      priority: isPendingPayment ? 'high' : 'normal',
    },
    {
      key: 'wash_mode',
      title: `บริการ ${session.package.name}`,
      detail: steps.length ? `${steps.length} ขั้นตอน` : 'ใช้ขั้นตอนตามแพ็กเกจ',
      status: isCompleted ? 'done' : isInProgress ? 'doing' : 'todo',
      priority: 'high',
    },
  ];

  if (activeMembership?.plan.vipFastLane) {
    tasks.push({
      key: 'vip_fast_lane',
      title: 'VIP Fast Lane',
      detail: `Active member: ${activeMembership.plan.name ?? activeMembership.plan.code}`,
      status: isCompleted ? 'done' : 'todo',
      priority: 'high',
    });
  }

  if (activeMembership?.plan.freeVacuumPerVisit || hasVacuumAddon) {
    tasks.push({
      key: 'free_vacuum',
      title: 'Free Vacuum',
      detail: activeMembership?.plan.freeVacuumPerVisit
        ? `Active member: ${activeMembership.plan.name ?? activeMembership.plan.code}`
        : 'ลูกค้าเลือก add-on',
      status: isCompleted ? 'done' : 'todo',
      priority: 'normal',
    });
  }

  if (needsGraphene) {
    tasks.push({
      key: 'graphene_shield',
      title: 'Graphene Shield',
      detail: membershipHasGrapheneCredit ? 'ใช้สิทธิ์ Graphene จาก membership' : 'บริการ Graphene ตามแพ็กเกจ',
      status: isCompleted ? 'done' : 'todo',
      priority: 'high',
    });
  }

  if (activeMembership) {
    tasks.push({
      key: 'membership_credit',
      title:
        activeMembership.plan.washLimit === 0
          ? 'Active member benefits'
          : membershipHasWashCredit
            ? 'ตัดสิทธิ์ Membership หลังล้างเสร็จ'
            : 'Membership wash credit เต็มแล้ว',
      detail: `Wash ${activeMembership.washUsed}/${activeMembership.plan.washLimit}`,
      status:
        activeMembership.plan.washLimit === 0
          ? isCompleted
            ? 'done'
            : 'todo'
          : isCompleted
            ? 'done'
            : membershipHasWashCredit
              ? 'todo'
              : 'blocked',
      priority: 'normal',
    });
  }

  return {
    membership: activeMembership
      ? {
          active: true,
          planCode: activeMembership.plan.code,
          planName: activeMembership.plan.name ?? activeMembership.plan.code,
          washUsed: activeMembership.washUsed,
          washLimit: activeMembership.plan.washLimit,
          grapheneUsed: activeMembership.grapheneUsed,
          grapheneLimit: activeMembership.plan.grapheneLimit,
          vipFastLane: activeMembership.plan.vipFastLane,
          freeVacuumPerVisit: activeMembership.plan.freeVacuumPerVisit,
        }
      : { active: false },
    tasks,
  };
}

function buildBranchFilter(
  admin: AdminWithScopes,
  branchId?: string | null
): {
  branchWhere: Prisma.BranchWhereInput;
  machineWhere: Prisma.MachineWhereInput;
  paymentWhere: Prisma.PaymentWhereInput;
  sessionWhere: Prisma.WashSessionWhereInput;
} {
  const scopedBranchId = ensureBranchAccess(admin, branchId);
  const branchWhere = getBranchWhereClause(admin.role, admin.branchScopes);
  const machineWhere = getMachineBranchFilter(admin.role, admin.branchScopes);
  const paymentWhere = getPaymentBranchFilter(admin.role, admin.branchScopes);
  const sessionWhere = getSessionBranchFilter(admin.role, admin.branchScopes);

  if (!scopedBranchId) {
    return { branchWhere, machineWhere, paymentWhere, sessionWhere };
  }

  return {
    branchWhere: { ...branchWhere, id: scopedBranchId },
    machineWhere: { ...machineWhere, branchId: scopedBranchId },
    paymentWhere: { ...paymentWhere, branchId: scopedBranchId },
    sessionWhere: { ...sessionWhere, branchId: scopedBranchId },
  };
}

async function resolveAdmin(c: any) {
  const admin = await getAdminWithScopes(c.get('adminId'));
  if (!admin) {
    return c.json({ message: 'Admin not found' }, 404);
  }
  return admin;
}

type AdminPaymentSummaryRecord = Prisma.PaymentGetPayload<{
  include: {
    branch: {
      select: {
        id: true;
        code: true;
        name: true;
        shortName: true;
      };
    };
    session: {
      select: {
        id: true;
        status: true;
        currentStep: true;
        totalSteps: true;
        progress: true;
        totalPrice: true;
        createdAt: true;
        machine: {
          select: {
            id: true;
            code: true;
            name: true;
            status: true;
          };
        };
        package: {
          select: {
            id: true;
            code: true;
            name: true;
          };
        };
        user: {
          select: {
            id: true;
            displayName: true;
            phone: true;
            lineUserId: true;
          };
        };
      };
    };
  };
}>;

type AdminPaymentRecord = Prisma.PaymentGetPayload<{
  include: {
    branch: {
      select: {
        id: true;
        code: true;
        name: true;
        shortName: true;
      };
    };
    session: {
      select: {
        id: true;
        status: true;
        currentStep: true;
        totalSteps: true;
        progress: true;
        totalPrice: true;
        createdAt: true;
        machine: {
          select: {
            id: true;
            code: true;
            name: true;
            status: true;
          };
        };
        package: {
          select: {
            id: true;
            code: true;
            name: true;
          };
        };
        user: {
          select: {
            id: true;
            displayName: true;
            phone: true;
            lineUserId: true;
          };
        };
      };
    };
    attempts: true;
  };
}>;

function mapPaymentAttempt(attempt: AdminPaymentRecord['attempts'][number]) {
  return {
    id: attempt.id,
    status: attempt.status,
    source: attempt.source,
    action: attempt.action,
    providerRef: attempt.providerRef,
    providerStatus: attempt.providerStatus,
    eventId: attempt.eventId,
    note: attempt.note,
    requestBody: attempt.requestBody,
    responseBody: attempt.responseBody,
    attemptedAt: attempt.attemptedAt,
  };
}

function getPaymentMetadata(payment: Pick<AdminPaymentSummaryRecord, 'metadata'>) {
  const metadata =
    payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
      ? (payment.metadata as Record<string, unknown>)
      : {};

  return metadata;
}

function mapPaymentBaseRecord(payment: AdminPaymentSummaryRecord | AdminPaymentRecord) {
  const metadata = getPaymentMetadata(payment);

  return {
    id: payment.id,
    sessionId: payment.sessionId,
    branchId: payment.branchId,
    userId: payment.userId,
    method: payment.method,
    provider: payment.provider,
    providerRef: payment.providerRef,
    providerStatus: payment.providerStatus,
    providerConfirmedAt: payment.providerConfirmedAt,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.reference,
    qrPayload: payment.qrPayload,
    expiresAt: payment.expiresAt,
    confirmedAt: payment.confirmedAt,
    failedAt: payment.failedAt,
    cancelledAt: payment.cancelledAt,
    refundedAt: payment.refundedAt,
    lastWebhookAt: payment.lastWebhookAt,
    lastWebhookEventId: payment.lastWebhookEventId,
    lastWebhookStatus: payment.lastWebhookStatus,
    lastReconciledAt: payment.lastReconciledAt,
    reconciliationAttempts: payment.reconciliationAttempts,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    needsManualReview: metadata.needsManualReview === true,
    manualReviewReason: typeof metadata.manualReviewReason === 'string' ? metadata.manualReviewReason : null,
    metadata,
    branch: payment.branch,
    session: {
      id: payment.session.id,
      status: payment.session.status,
      currentStep: payment.session.currentStep,
      totalSteps: payment.session.totalSteps,
      progress: payment.session.progress,
      totalPrice: payment.session.totalPrice,
      createdAt: payment.session.createdAt,
      machine: payment.session.machine,
      package: payment.session.package,
      user: payment.session.user,
    },
    diagnostics: {
      webhook: {
        lastWebhookAt: payment.lastWebhookAt,
        lastWebhookEventId: payment.lastWebhookEventId,
        lastWebhookStatus: payment.lastWebhookStatus,
      },
      reconcile: {
        lastReconciledAt: payment.lastReconciledAt,
        reconciliationAttempts: payment.reconciliationAttempts,
      },
      provider: {
        provider: payment.provider,
        providerRef: payment.providerRef,
        providerStatus: payment.providerStatus,
        providerConfirmedAt: payment.providerConfirmedAt,
      },
      review: {
        needsManualReview: metadata.needsManualReview === true,
        manualReviewReason: typeof metadata.manualReviewReason === 'string' ? metadata.manualReviewReason : null,
        lastTransitionSource:
          typeof metadata.lastTransitionSource === 'string' ? metadata.lastTransitionSource : null,
        lastTransitionAt: typeof metadata.lastTransitionAt === 'string' ? metadata.lastTransitionAt : null,
        lastTransitionNote:
          typeof metadata.lastTransitionNote === 'string' ? metadata.lastTransitionNote : null,
      },
    },
  };
}

function mapPaymentSummaryRecord(payment: AdminPaymentSummaryRecord) {
  return {
    ...mapPaymentBaseRecord(payment),
    attempts: [],
  };
}

function mapPaymentRecord(payment: AdminPaymentRecord) {
  return {
    ...mapPaymentBaseRecord(payment),
    attempts: payment.attempts.map((attempt) => mapPaymentAttempt(attempt)),
  };
}

adminRoutes.use('/login', adminAuthRateLimit);
adminRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = z
    .object({ email: z.string().email(), password: z.string().min(6) })
    .parse(body);

  const admin = await prisma.adminUser.findUnique({
    where: { email },
    include: {
      branchScopes: {
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });

  if (!admin || !admin.isActive) {
    await logSystemAction({
      action: 'admin.login.failed',
      entityType: 'admin_user',
      metadata: { email, reason: 'unknown_or_inactive' },
    });
    return c.json({ message: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    await logSystemAction({
      action: 'admin.login.failed',
      entityType: 'admin_user',
      entityId: admin.id,
      metadata: { email, reason: 'invalid_password' },
    });
    return c.json({ message: 'Invalid credentials' }, 401);
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  const branchIds = getScopedBranchIds(admin.role, admin.branchScopes);

  await logAdminAction({
    adminUserId: admin.id,
    action: 'admin.login.success',
    entityType: 'admin_user',
    entityId: admin.id,
    metadata: {
      role: admin.role,
      branchIds,
    },
  });

  return c.json({
    data: {
      admin: mapAdminIdentity(admin),
      token: signAdminAccessToken(admin.id, admin.role, branchIds),
      tokens: {
        accessToken: signAdminAccessToken(admin.id, admin.role, branchIds),
        refreshToken: signAdminRefreshToken(admin.id, admin.role, branchIds),
      },
    },
  });
});

adminRoutes.post('/refresh', async (c) => {
  const body = await c.req.json();
  const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(body);

  try {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.subjectType !== 'admin' || payload.type !== 'refresh') {
      return c.json({ message: 'Invalid refresh token' }, 401);
    }

    const admin = await getAdminWithScopes(payload.subjectId);
    if (!admin || !admin.isActive) {
      return c.json({ message: 'Admin not found' }, 404);
    }

    const branchIds = getScopedBranchIds(admin.role, admin.branchScopes);

    return c.json({
      data: {
        accessToken: signAdminAccessToken(admin.id, admin.role, branchIds),
        admin: mapAdminIdentity(admin),
      },
    });
  } catch {
    return c.json({ message: 'Invalid refresh token' }, 401);
  }
});

adminRoutes.get('/me', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  return c.json({
    data: {
      admin: mapAdminIdentity(admin),
    },
  });
});

adminRoutes.get('/dashboard', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const { branchWhere, machineWhere, paymentWhere, sessionWhere } = buildBranchFilter(admin, branchId);
    const today = startOfDay();
    const trendSince = startOfLookbackDays(7);
    const customerTrendSince = startOfLookbackDays(14);
    const previousCustomerWindowStart = rangeStartFrom(customerTrendSince, 14);

    const [
      branches,
      machines,
      todaysSessions,
      trendPayments,
      recentSessions,
      totalCustomers,
      totalSessions,
      totalRevenueAggregate,
      recentCustomerUsers,
    ] =
      await Promise.all([
        prisma.branch.findMany({
          where: branchWhere,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        }),
        prisma.machine.findMany({
          where: machineWhere,
          select: {
            id: true,
            branchId: true,
            status: true,
            lastHeartbeat: true,
          },
        }),
        prisma.washSession.findMany({
          where: {
            ...sessionWhere,
            createdAt: { gte: today },
          },
          select: {
            id: true,
            branchId: true,
            status: true,
            rating: true,
          },
        }),
        prisma.payment.findMany({
          where: {
            ...paymentWhere,
            status: 'confirmed',
            createdAt: { gte: trendSince },
          },
          select: {
            branchId: true,
            amount: true,
            createdAt: true,
          },
        }),
        prisma.washSession.findMany({
          where: sessionWhere,
          include: {
            branch: { select: { id: true, name: true, shortName: true } },
            machine: { select: { id: true, name: true, status: true } },
            package: { select: { id: true, name: true } },
            user: { select: { id: true, displayName: true } },
            payment: { select: { id: true, status: true, amount: true, reference: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.user.count({
          where: {
            sessions: {
              some: sessionWhere,
            },
          },
        }),
        prisma.washSession.count({
          where: sessionWhere,
        }),
        prisma.payment.aggregate({
          where: {
            ...paymentWhere,
            status: 'confirmed',
          },
          _sum: {
            amount: true,
          },
        }),
        prisma.user.findMany({
          where: {
            createdAt: { gte: previousCustomerWindowStart },
            sessions: {
              some: sessionWhere,
            },
          },
          select: {
            id: true,
            createdAt: true,
          },
        }),
      ]);

    const todayRevenue = trendPayments
      .filter((payment) => payment.createdAt >= today)
      .reduce((sum, payment) => sum + payment.amount, 0);

    const machineSummary = machineStatuses.reduce(
      (summary, status) => {
        summary[status] = machines.filter((machine) => machine.status === status).length;
        return summary;
      },
      {} as Record<MachineStatus, number>
    );

    const sessionStatusSummary = sessionStatuses.reduce(
      (summary, status) => {
        summary[status] = todaysSessions.filter((session) => session.status === status).length;
        return summary;
      },
      {} as Record<WashSessionStatus, number>
    );

    const revenueTrendMap = new Map<string, { total: number; sessions: number }>();
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(trendSince);
      date.setDate(trendSince.getDate() + offset);
      revenueTrendMap.set(date.toISOString().slice(0, 10), { total: 0, sessions: 0 });
    }

    trendPayments.forEach((payment) => {
      const key = payment.createdAt.toISOString().slice(0, 10);
      const entry = revenueTrendMap.get(key);
      if (entry) {
        entry.total += payment.amount;
        entry.sessions += 1;
      }
    });

    const customerGrowthTrendMap = new Map<string, number>();
    for (let offset = 0; offset < 14; offset += 1) {
      const date = new Date(customerTrendSince);
      date.setDate(customerTrendSince.getDate() + offset);
      customerGrowthTrendMap.set(date.toISOString().slice(0, 10), 0);
    }

    let currentCustomerWindowCount = 0;
    let previousCustomerWindowCount = 0;

    recentCustomerUsers.forEach((user) => {
      if (user.createdAt >= customerTrendSince) {
        currentCustomerWindowCount += 1;
        const key = user.createdAt.toISOString().slice(0, 10);
        customerGrowthTrendMap.set(key, (customerGrowthTrendMap.get(key) ?? 0) + 1);
        return;
      }

      if (user.createdAt >= previousCustomerWindowStart) {
        previousCustomerWindowCount += 1;
      }
    });

    const machineHealth = {
      online: machines.filter((machine) => machine.status !== 'offline').length,
      offline: machines.filter((machine) => machine.status === 'offline').length,
      maintenance: machines.filter((machine) => machine.status === 'maintenance').length,
      washing: machines.filter((machine) => machine.status === 'washing').length,
      idle: machines.filter((machine) => machine.status === 'idle').length,
      reserved: machines.filter((machine) => machine.status === 'reserved').length,
      onlineRate:
        machines.length > 0
          ? Number(
              ((machines.filter((machine) => machine.status !== 'offline').length / machines.length) * 100).toFixed(1)
            )
          : 0,
    };

    return c.json({
      data: {
        admin: mapAdminIdentity(admin),
        selectedBranchId: branchId ?? null,
        summary: {
          totalBranches: branches.length,
          totalMachines: machines.length,
          activeMachines: machines.filter((machine) => machine.status !== 'offline').length,
          totalSessions,
          todaySessions: todaysSessions.length,
          activeSessions: todaysSessions.filter((session) =>
            ['ready_to_wash', 'in_progress'].includes(session.status)
          ).length,
          totalRevenue: totalRevenueAggregate._sum.amount ?? 0,
          todayRevenue,
          totalCustomers,
          customerGrowthCurrent: currentCustomerWindowCount,
          customerGrowthPrevious: previousCustomerWindowCount,
        },
        machineSummary,
        machineHealth,
        sessionStatusSummary,
        revenueTrend: Array.from(revenueTrendMap.entries()).map(([date, value]) => ({
          date,
          total: value.total,
          sessions: value.sessions,
          avgTicket: value.sessions > 0 ? Math.round(value.total / value.sessions) : 0,
        })),
        customerGrowthTrend: Array.from(customerGrowthTrendMap.entries()).map(([date, customers]) => ({
          date,
          customers,
        })),
        branchPerformance: branches.map((branch) => {
          const branchTodaySessions = todaysSessions.filter((session) => session.branchId === branch.id);
          const branchTodayRevenue = trendPayments
            .filter((payment) => payment.branchId === branch.id && payment.createdAt >= today)
            .reduce((sum, payment) => sum + payment.amount, 0);
          const branchMachines = machines.filter((machine) => machine.branchId === branch.id);
          const ratings = branchTodaySessions
            .map((session) => session.rating)
            .filter((value): value is number => typeof value === 'number');

          return {
            id: branch.id,
            code: branch.code,
            name: branch.name,
            shortName: branch.shortName,
            isActive: branch.isActive,
            todayRevenue: branchTodayRevenue,
            todaySessions: branchTodaySessions.length,
            activeSessions: branchTodaySessions.filter((session) =>
              ['ready_to_wash', 'in_progress'].includes(session.status)
            ).length,
            machineCount: branchMachines.length,
            machineSummary: {
              idle: branchMachines.filter((machine) => machine.status === 'idle').length,
              reserved: branchMachines.filter((machine) => machine.status === 'reserved').length,
              washing: branchMachines.filter((machine) => machine.status === 'washing').length,
              maintenance: branchMachines.filter((machine) => machine.status === 'maintenance').length,
              offline: branchMachines.filter((machine) => machine.status === 'offline').length,
            },
            avgRating:
              ratings.length > 0
                ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1))
                : null,
          };
        }),
        recentSessions: recentSessions.map((session) => ({
          id: session.id,
          branchId: session.branchId,
          machineId: session.machineId,
          userId: session.userId,
          status: session.status,
          progress: session.progress,
          currentStep: session.currentStep,
          totalSteps: session.totalSteps,
          totalPrice: session.totalPrice,
          carSize: session.carSize,
          rating: session.rating,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          completedAt: session.completedAt,
          branch: session.branch,
          machine: session.machine,
          package: session.package,
          user: session.user,
          payment: session.payment,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/branches', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const { branchWhere } = buildBranchFilter(admin, branchId);
    const today = startOfDay();

    const branches = await prisma.branch.findMany({
      where: branchWhere,
      include: {
        settings: true,
        _count: {
          select: {
            machines: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const branchIds = branches.map((branch) => branch.id);
    const [todayPayments, todaySessions, ratings] = await Promise.all([
      prisma.payment.findMany({
        where: {
          branchId: { in: branchIds },
          status: 'confirmed',
          createdAt: { gte: today },
        },
        select: { branchId: true, amount: true },
      }),
      prisma.washSession.findMany({
        where: {
          branchId: { in: branchIds },
          createdAt: { gte: today },
        },
        select: { branchId: true },
      }),
      prisma.washSession.findMany({
        where: {
          branchId: { in: branchIds },
          rating: { not: null },
        },
        select: { branchId: true, rating: true },
      }),
    ]);

    return c.json({
      data: branches.map((branch) => {
        const branchRatings = ratings
          .filter((session) => session.branchId === branch.id && typeof session.rating === 'number')
          .map((session) => session.rating as number);

        return {
          id: branch.id,
          code: branch.code,
          name: branch.name,
          shortName: branch.shortName,
          address: branch.address,
          area: branch.area,
          type: branch.type,
          ownershipType: branch.ownershipType,
          franchiseCode: branch.franchiseCode,
          lat: branch.lat,
          lng: branch.lng,
          mapsUrl: branch.mapsUrl,
          promptPayId: branch.promptPayId,
          promptPayName: branch.promptPayName,
          ownerName: branch.ownerName,
          isActive: branch.isActive,
          hours: branch.hours,
          settings: mapBranchSettings(branch.settings),
          machineCount: branch._count.machines,
          todayRevenue: todayPayments
            .filter((payment) => payment.branchId === branch.id)
            .reduce((sum, payment) => sum + payment.amount, 0),
          todaySessions: todaySessions.filter((session) => session.branchId === branch.id).length,
          avgRating:
            branchRatings.length > 0
              ? Number((branchRatings.reduce((sum, rating) => sum + rating, 0) / branchRatings.length).toFixed(1))
              : null,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load branches';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/branches', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');
  if (role !== 'hq_admin') {
    return c.json({ message: 'Only HQ can create branches' }, 403);
  }

  const body = await c.req.json();
  const data = createBranchSchema.parse(body);

  const branch = await prisma.branch.create({
    data: {
      code: data.code,
      name: data.name,
      shortName: data.shortName ?? null,
      address: data.address,
      area: data.area,
      type: data.type,
      ownershipType: data.ownershipType,
      franchiseCode: data.franchiseCode ?? null,
      lat: data.lat,
      lng: data.lng,
      promptPayId: data.promptPayId,
      promptPayName: data.promptPayName,
      ownerName: data.ownerName ?? null,
      mapsUrl: data.mapsUrl ?? null,
      hours: data.hours ?? null,
      isActive: data.isActive ?? true,
    },
  });
  await prisma.branchSettings.create({
    data: {
      branchId: branch.id,
      ...data.settings,
    },
  });

  await logAdminAction({
    adminUserId: adminId,
    action: 'admin.branch.create',
    entityType: 'branch',
    entityId: branch.id,
    branchId: branch.id,
    metadata: {
      code: branch.code,
      name: branch.name,
    },
  });

  return c.json({ data: branch }, 201);
});

adminRoutes.patch('/branches/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const adminId = c.get('adminId');
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  if (
    admin.role !== 'hq_admin' &&
    !admin.branchScopes.some((scope: AdminBranchScope) => scope.branchId === id)
  ) {
    return c.json({ message: 'Branch access denied' }, 403);
  }

  const body = await c.req.json();
  const data = updateBranchSchema.parse(body);

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      code: data.code,
      name: data.name,
      shortName: data.shortName,
      address: data.address,
      area: data.area,
      type: data.type,
      ownershipType: data.ownershipType,
      franchiseCode: data.franchiseCode,
      lat: data.lat,
      lng: data.lng,
      promptPayId: data.promptPayId,
      promptPayName: data.promptPayName,
      ownerName: data.ownerName,
      mapsUrl: data.mapsUrl,
      hours: data.hours,
      isActive: data.isActive,
    },
  });

  if (data.settings) {
    await prisma.branchSettings.upsert({
      where: { branchId: id },
      update: data.settings,
      create: {
        branchId: id,
        ...data.settings,
      },
    });
  }

  await logAdminAction({
    adminUserId: adminId,
    action: 'admin.branch.update',
    entityType: 'branch',
    entityId: id,
    branchId: id,
    metadata: data as unknown as Prisma.InputJsonValue,
  });

  return c.json({ data: branch });
});

adminRoutes.get('/machines', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const status = c.req.query('status');
    const { machineWhere } = buildBranchFilter(admin, branchId);

    const where: Prisma.MachineWhereInput = { ...machineWhere };
    if (status && machineStatuses.includes(status as MachineStatus)) {
      where.status = status as MachineStatus;
    }

    const machines = await prisma.machine.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, shortName: true } },
        sessions: {
          select: {
            id: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ branchId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    return c.json({
      data: machines.map((machine) => {
        const activeSession = machine.sessions.find((session) =>
          ['pending_payment', 'ready_to_wash', 'in_progress'].includes(session.status)
        );

        return {
          id: machine.id,
          branchId: machine.branchId,
          code: machine.code,
          name: machine.name,
          type: machine.type,
          status: machine.status,
          espDeviceId: machine.espDeviceId,
          isEnabled: machine.isEnabled,
          maintenanceNote: machine.maintenanceNote,
          firmwareVersion: machine.firmwareVersion,
          lastHeartbeat: machine.lastHeartbeat,
          totalWashes: machine.sessions.filter((session) => session.status === 'completed').length,
          currentSessionId: activeSession?.id ?? null,
          branch: machine.branch,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load machines';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/machines/:id/command', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  const machineId = c.req.param('id');
  const body = await c.req.json();
  const { command } = z
    .object({ command: z.enum(['restart', 'maintenance_on', 'maintenance_off']) })
    .parse(body);

  if (admin instanceof Response) {
    return admin;
  }

  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: { branch: true },
  });

  if (!machine) {
    return c.json({ message: 'Machine not found' }, 404);
  }

  if (
    admin.role !== 'hq_admin' &&
    !admin.branchScopes.some(
      (scope: AdminBranchScope) => scope.branchId === machine.branchId && scope.canManageMachines
    )
  ) {
    return c.json({ message: 'Machine access denied' }, 403);
  }

  const sent = publishMachineCommand(machine.branchId, machine.espDeviceId, command);

  if (command === 'maintenance_on') {
    await handleMachineEvent(
      {
        type: 'maintenance',
        machineId,
        branchId: machine.branchId,
        espDeviceId: machine.espDeviceId,
        reason: 'admin_command.maintenance_on',
      },
      'admin'
    );
  } else if (command === 'maintenance_off') {
    await handleMachineEvent(
      {
        type: 'heartbeat',
        machineId,
        branchId: machine.branchId,
        espDeviceId: machine.espDeviceId,
        machineStatus: 'idle',
        reason: 'admin_command.maintenance_off',
      },
      'admin'
    );
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: 'admin.machine.command',
    entityType: 'machine',
    entityId: machine.id,
    branchId: machine.branchId,
    metadata: {
      command,
      sent,
      machineCode: machine.code,
      espDeviceId: machine.espDeviceId,
    },
  });

  return c.json({
    data: {
      machineId,
      command,
      message: `Command ${command} ${sent ? 'sent' : 'queued (MQTT offline)'}`,
    },
  });
});

adminRoutes.get('/sessions', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 50);
    const status = c.req.query('status');
    const branchId = c.req.query('branchId');
    const { sessionWhere } = buildBranchFilter(admin, branchId);

    const where: Prisma.WashSessionWhereInput = {
      ...sessionWhere,
    };

    if (status && sessionStatuses.includes(status as WashSessionStatus)) {
      where.status = status as WashSessionStatus;
    }

    const [sessions, total] = await Promise.all([
      prisma.washSession.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, shortName: true } },
          machine: { select: { id: true, code: true, name: true, status: true } },
          package: { select: { id: true, code: true, name: true, steps: true, features: true } },
          user: {
            select: {
              id: true,
              displayName: true,
              phone: true,
              lineUserId: true,
              memberships: {
                where: { status: 'active' },
                include: { plan: true },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          payment: { select: { id: true, status: true, amount: true, reference: true, confirmedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.washSession.count({ where }),
    ]);

    return c.json({
      data: sessions.map((session) => {
        const service = buildServiceTasks(session);

        return {
          id: session.id,
          branchId: session.branchId,
          machineId: session.machineId,
          userId: session.userId,
          status: session.status,
          currentStep: session.currentStep,
          totalSteps: session.totalSteps,
          progress: session.progress,
          carSize: session.carSize,
          addons: session.addons,
          subtotalPrice: session.subtotalPrice,
          discountAmount: session.discountAmount,
          totalPrice: session.totalPrice,
          rating: session.rating,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          branch: session.branch,
          machine: session.machine,
          package: session.package,
          user: {
            id: session.user.id,
            displayName: session.user.displayName,
            phone: session.user.phone,
            lineUserId: session.user.lineUserId,
          },
          payment: session.payment,
          serviceTasks: service.tasks,
          membership: service.membership,
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load sessions';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/sessions/:id/logs', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const sessionId = c.req.param('id');
    const branchId = c.req.query('branchId');
    const { sessionWhere } = buildBranchFilter(admin, branchId);

    const session = await prisma.washSession.findFirst({
      where: { ...sessionWhere, id: sessionId },
      include: {
        branch: { select: { id: true, name: true, shortName: true } },
        machine: { select: { id: true, code: true, name: true, status: true } },
        package: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, displayName: true, phone: true, lineUserId: true } },
        payment: {
          include: {
            attempts: {
              orderBy: { attemptedAt: 'desc' },
              take: 30,
            },
          },
        },
      },
    });

    if (!session) {
      return c.json({ message: 'Session not found' }, 404);
    }

    const membership = await prisma.userMembership.findFirst({
      where: {
        userId: session.userId,
        status: 'active',
        plan: { code: 'GRAPHENE_MEMBERSHIP' },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: session.id },
          { entityId: session.payment?.id ?? '__none__' },
          { entityId: membership?.id ?? '__none__' },
          { metadata: { path: ['sessionId'], equals: session.id } },
        ],
      },
      include: {
        adminUser: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    const timeline = [
      {
        type: 'session_created',
        title: 'สร้างรอบล้าง',
        at: session.createdAt.toISOString(),
        detail: `${session.package.name} / ${session.machine.name}`,
      },
      session.payment
        ? {
            type: 'payment_created',
            title: 'สร้างรายการชำระเงิน',
            at: session.payment.createdAt.toISOString(),
            detail: `${session.payment.amount.toLocaleString()} ${session.payment.currency} / ${session.payment.status}`,
          }
        : null,
      session.payment?.confirmedAt
        ? {
            type: 'payment_confirmed',
            title: 'ยืนยันการชำระเงิน',
            at: session.payment.confirmedAt.toISOString(),
            detail: session.payment.reference ?? session.payment.provider,
          }
        : null,
      session.startedAt
        ? {
            type: 'wash_started',
            title: 'เริ่มล้าง',
            at: session.startedAt.toISOString(),
            detail: session.machine.name,
          }
        : null,
      session.completedAt
        ? {
            type: 'wash_completed',
            title: 'ล้างเสร็จ',
            at: session.completedAt.toISOString(),
            detail: `Progress ${session.progress}%`,
          }
        : null,
      ...(session.payment?.attempts ?? []).map((attempt) => ({
        type: 'payment_attempt',
        title: attempt.action ?? 'payment attempt',
        at: attempt.attemptedAt.toISOString(),
        detail: `${attempt.source} / ${attempt.status}${attempt.note ? ` / ${attempt.note}` : ''}`,
      })),
      ...auditLogs.map((log) => ({
        type: 'audit_log',
        title: log.action,
        at: log.createdAt.toISOString(),
        detail: `${log.actorType}${log.adminUser ? ` / ${log.adminUser.name}` : ''}`,
        metadata: log.metadata,
      })),
    ]
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return c.json({
      data: {
        session: {
          id: session.id,
          status: session.status,
          progress: session.progress,
          branch: session.branch,
          machine: session.machine,
          package: session.package,
          user: session.user,
          payment: session.payment
            ? {
                id: session.payment.id,
                status: session.payment.status,
                amount: session.payment.amount,
                currency: session.payment.currency,
                provider: session.payment.provider,
                reference: session.payment.reference,
                confirmedAt: session.payment.confirmedAt?.toISOString() ?? null,
              }
            : null,
        },
        timeline,
        auditLogs: auditLogs.map((log) => ({
          id: log.id,
          actorType: log.actorType,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          branchId: log.branchId,
          metadata: log.metadata,
          createdAt: log.createdAt.toISOString(),
          adminUser: log.adminUser,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load session logs';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/revenue', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const days = Math.min(Math.max(Number(c.req.query('days') || 30), 1), 365);
    const branchId = c.req.query('branchId');
    const since = startOfLookbackDays(days);
    const previousSince = rangeStartFrom(since, days);
    const currentDateKeys = buildRevenueDateKeys(since, days);
    const previousDateKeys = new Set(buildRevenueDateKeys(previousSince, days));

    let branchWhere = getBranchWhereClause(admin.role, admin.branchScopes);
    let paymentWhere = getPaymentBranchFilter(admin.role, admin.branchScopes);
    const scopedBranchId = ensureBranchAccess(admin, branchId);

    if (admin.role !== 'hq_admin') {
      const revenueBranchIds = admin.branchScopes
        .filter((scope) => scope.canViewRevenue)
        .map((scope) => scope.branchId);

      if (revenueBranchIds.length === 0 || (scopedBranchId && !revenueBranchIds.includes(scopedBranchId))) {
        throw new Error('Branch access denied');
      }

      branchWhere = { id: { in: revenueBranchIds } };
      paymentWhere = { branchId: { in: revenueBranchIds } };
    }

    if (scopedBranchId) {
      branchWhere = { ...branchWhere, id: scopedBranchId };
      paymentWhere = { ...paymentWhere, branchId: scopedBranchId };
    }

    const [branches, payments] = await Promise.all([
      prisma.branch.findMany({
        where: branchWhere,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          shortName: true,
          ownershipType: true,
          isActive: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          AND: [
            paymentWhere,
            {
              OR: [
                { createdAt: { gte: previousSince } },
                { confirmedAt: { gte: previousSince } },
                { providerConfirmedAt: { gte: previousSince } },
                { refundedAt: { gte: previousSince } },
              ],
            },
          ],
        },
        include: {
          branch: { select: { id: true, code: true, name: true, shortName: true, ownershipType: true } },
          session: {
            select: {
              status: true,
              subtotalPrice: true,
              discountAmount: true,
              totalPrice: true,
              completedAt: true,
              createdAt: true,
              package: { select: { id: true, code: true, name: true } },
              machine: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const dailyMap = new Map<
      string,
      { total: number; grossTotal: number; discountAmount: number; refundedAmount: number; netTotal: number; sessions: number }
    >();
    currentDateKeys.forEach((date) =>
      dailyMap.set(date, { total: 0, grossTotal: 0, discountAmount: 0, refundedAmount: 0, netTotal: 0, sessions: 0 })
    );

    const branchMap = new Map<
      string,
      {
        branchId: string;
        code: string;
        name: string;
        ownershipType: string;
        grossSales: number;
        discountAmount: number;
        refundedAmount: number;
        total: number;
        netSales: number;
        sessions: number;
        completedSessions: number;
        pendingAmount: number;
        pendingCount: number;
        refundCount: number;
        cashSales: number;
        onlineSales: number;
      }
    >();
    branches.forEach((branch) => {
      branchMap.set(branch.id, {
        branchId: branch.id,
        code: branch.code,
        name: branch.shortName || branch.name,
        ownershipType: branch.ownershipType,
        grossSales: 0,
        discountAmount: 0,
        refundedAmount: 0,
        total: 0,
        netSales: 0,
        sessions: 0,
        completedSessions: 0,
        pendingAmount: 0,
        pendingCount: 0,
        refundCount: 0,
        cashSales: 0,
        onlineSales: 0,
      });
    });

    const packageMap = new Map<
      string,
      { packageId: string; code: string; name: string; grossSales: number; discountAmount: number; total: number; sessions: number }
    >();
    const methodMap = new Map<string, { method: string; total: number; sessions: number }>();
    const providerMap = new Map<string, { provider: string; total: number; sessions: number }>();
    const statusMap = new Map<string, { status: string; count: number; amount: number }>();

    const percentChange = (current: number, previous: number) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    let grossSales = 0;
    let discountAmount = 0;
    let confirmedAmount = 0;
    let refundedAmount = 0;
    let pendingAmount = 0;
    let confirmedSessions = 0;
    let completedSessions = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let refundCount = 0;
    let manualReviewCount = 0;
    let previousConfirmedAmount = 0;
    let previousRefundedAmount = 0;

    payments.forEach((payment) => {
      const salesDate = getPaymentSalesDate(payment);
      const salesDateKey = getBangkokDateKey(salesDate);
      const createdDateKey = getBangkokDateKey(payment.createdAt);
      const refundDateKey = payment.refundedAt ? getBangkokDateKey(payment.refundedAt) : null;
      const isCurrentSale = currentDateKeys.includes(salesDateKey);
      const isPreviousSale = previousDateKeys.has(salesDateKey);
      const isCurrentCreated = currentDateKeys.includes(createdDateKey);
      const isCurrentRefund = refundDateKey ? currentDateKeys.includes(refundDateKey) : false;
      const isPreviousRefund = refundDateKey ? previousDateKeys.has(refundDateKey) : false;
      const sessionDiscount = payment.session?.discountAmount ?? 0;
      const sessionGross = payment.session?.subtotalPrice ?? payment.amount + sessionDiscount;
      const branchEntry =
        branchMap.get(payment.branchId) ??
        {
          branchId: payment.branchId,
          code: payment.branch.code,
          name: payment.branch.shortName || payment.branch.name,
          ownershipType: payment.branch.ownershipType,
          grossSales: 0,
          discountAmount: 0,
          refundedAmount: 0,
          total: 0,
          netSales: 0,
          sessions: 0,
          completedSessions: 0,
          pendingAmount: 0,
          pendingCount: 0,
          refundCount: 0,
          cashSales: 0,
          onlineSales: 0,
        };

      if (isCurrentCreated) {
        const statusEntry = statusMap.get(payment.status) ?? { status: payment.status, count: 0, amount: 0 };
        statusEntry.count += 1;
        statusEntry.amount += payment.amount;
        statusMap.set(payment.status, statusEntry);
      }

      if (payment.status === 'confirmed' && isCurrentSale) {
        grossSales += sessionGross;
        discountAmount += sessionDiscount;
        confirmedAmount += payment.amount;
        confirmedSessions += 1;
        if (payment.session?.status === 'completed') {
          completedSessions += 1;
          branchEntry.completedSessions += 1;
        }

        branchEntry.grossSales += sessionGross;
        branchEntry.discountAmount += sessionDiscount;
        branchEntry.total += payment.amount;
        branchEntry.netSales += payment.amount;
        branchEntry.sessions += 1;
        if (payment.method === 'cash' || payment.method === 'manual') {
          branchEntry.cashSales += payment.amount;
        } else {
          branchEntry.onlineSales += payment.amount;
        }

        const daily = dailyMap.get(salesDateKey);
        if (daily) {
          daily.grossTotal += sessionGross;
          daily.discountAmount += sessionDiscount;
          daily.netTotal += payment.amount;
          daily.total += payment.amount;
          daily.sessions += 1;
        }

        const packageId = payment.session?.package?.id ?? 'unknown';
        const packageName = payment.session?.package?.name ?? 'Unknown package';
        const packageCode = payment.session?.package?.code ?? 'UNKNOWN';
        const packageEntry = packageMap.get(packageId) ?? {
        packageId,
        code: packageCode,
        name: packageName,
        grossSales: 0,
        discountAmount: 0,
        total: 0,
        sessions: 0,
      };
        packageEntry.grossSales += sessionGross;
        packageEntry.discountAmount += sessionDiscount;
      packageEntry.total += payment.amount;
      packageEntry.sessions += 1;
      packageMap.set(packageId, packageEntry);

        const methodEntry = methodMap.get(payment.method) ?? { method: payment.method, total: 0, sessions: 0 };
        methodEntry.total += payment.amount;
        methodEntry.sessions += 1;
        methodMap.set(payment.method, methodEntry);

        const providerEntry = providerMap.get(payment.provider) ?? { provider: payment.provider, total: 0, sessions: 0 };
        providerEntry.total += payment.amount;
        providerEntry.sessions += 1;
        providerMap.set(payment.provider, providerEntry);
      }

      if (payment.status === 'confirmed' && isPreviousSale) {
        previousConfirmedAmount += payment.amount;
      }

      if (payment.status === 'refunded' && isCurrentRefund) {
        refundedAmount += payment.amount;
        refundCount += 1;
        branchEntry.refundedAmount += payment.amount;
        branchEntry.netSales -= payment.amount;
        branchEntry.total -= payment.amount;

        const daily = dailyMap.get(refundDateKey);
        if (daily) {
          daily.refundedAmount += payment.amount;
          daily.netTotal -= payment.amount;
          daily.total -= payment.amount;
        }
      }

      if (payment.status === 'refunded' && isPreviousRefund) {
        previousRefundedAmount += payment.amount;
      }

      if (payment.status === 'pending' && isCurrentCreated) {
        pendingAmount += payment.amount;
        pendingCount += 1;
        branchEntry.pendingAmount += payment.amount;
        branchEntry.pendingCount += 1;
      }

      if (['failed', 'cancelled', 'expired'].includes(payment.status) && isCurrentCreated) {
        failedCount += 1;
      }

      if (
        payment.metadata &&
        typeof payment.metadata === 'object' &&
        !Array.isArray(payment.metadata) &&
        (payment.metadata as Record<string, unknown>).needsManualReview === true &&
        isCurrentCreated
      ) {
        manualReviewCount += 1;
      }

      branchMap.set(payment.branchId, branchEntry);
    });

    const totalRevenue = confirmedAmount - refundedAmount;
    const previousNetRevenue = previousConfirmedAmount - previousRefundedAmount;
    const branchTotals = Array.from(branchMap.values())
      .map((branch) => ({
        ...branch,
        avgTicket: branch.sessions > 0 ? Math.round(branch.netSales / branch.sessions) : 0,
        completionRate: branch.sessions > 0 ? Number(((branch.completedSessions / branch.sessions) * 100).toFixed(1)) : 0,
        revenueShare: totalRevenue !== 0 ? Number(((branch.netSales / totalRevenue) * 100).toFixed(1)) : 0,
      }))
      .sort((left, right) => right.netSales - left.netSales);

    const packageBreakdown = Array.from(packageMap.values())
      .map((pkg) => ({
        ...pkg,
        avgTicket: pkg.sessions > 0 ? Math.round(pkg.total / pkg.sessions) : 0,
        revenueShare: confirmedAmount > 0 ? Number(((pkg.total / confirmedAmount) * 100).toFixed(1)) : 0,
      }))
      .sort((left, right) => right.total - left.total);

    const paymentMethodBreakdown = Array.from(methodMap.values())
      .map((method) => ({
        ...method,
        share: confirmedAmount > 0 ? Number(((method.total / confirmedAmount) * 100).toFixed(1)) : 0,
      }))
      .sort((left, right) => right.total - left.total);

    const providerBreakdown = Array.from(providerMap.values())
      .map((provider) => ({
        ...provider,
        share: confirmedAmount > 0 ? Number(((provider.total / confirmedAmount) * 100).toFixed(1)) : 0,
      }))
      .sort((left, right) => right.total - left.total);

    return c.json({
      data: {
        period: days,
        totalRevenue,
        grossSales,
        discountAmount,
        refundedAmount,
        netRevenue: totalRevenue,
        previousNetRevenue,
        revenueGrowthPercent: percentChange(totalRevenue, previousNetRevenue),
        sessionCount: confirmedSessions,
        completedSessions,
        completionRate: confirmedSessions > 0 ? Number(((completedSessions / confirmedSessions) * 100).toFixed(1)) : 0,
        pendingAmount,
        pendingCount,
        failedCount,
        refundCount,
        manualReviewCount,
        avgTicket: confirmedSessions > 0 ? Math.round(totalRevenue / confirmedSessions) : 0,
        activeBranchCount: branchTotals.filter((branch) => branch.netSales !== 0 || branch.sessions > 0).length,
        branchCount: branches.length,
        salesLogic: {
          revenueBasis: 'confirmed_at_or_provider_confirmed_at',
          timezone: 'Asia/Bangkok',
          includedStatuses: ['confirmed'],
          refundedStatusIsSubtracted: true,
          pendingIsTrackedOutsideRevenue: true,
        },
        dailyRevenue: Array.from(dailyMap.entries()).map(([date, value]) => ({
          date,
          total: value.total,
          grossTotal: value.grossTotal,
          discountAmount: value.discountAmount,
          refundedAmount: value.refundedAmount,
          netTotal: value.netTotal,
          sessions: value.sessions,
          avgTicket: value.sessions > 0 ? Math.round(value.netTotal / value.sessions) : 0,
        })),
        branchTotals,
        packageBreakdown,
        paymentMethodBreakdown,
        providerBreakdown,
        statusBreakdown: Array.from(statusMap.values()).sort((left, right) => right.amount - left.amount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load revenue';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/payments', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 50);
    const branchId = c.req.query('branchId');
    const status = c.req.query('status');
    const provider = c.req.query('provider');
    const search = c.req.query('search')?.trim();
    const { paymentWhere } = buildBranchFilter(admin, branchId);

    const where: Prisma.PaymentWhereInput = { ...paymentWhere };
    if (status && paymentStatuses.includes(status as PaymentStatus)) {
      where.status = status as PaymentStatus;
    }
    if (provider) {
      where.provider = provider;
    }
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { reference: { contains: search, mode: 'insensitive' } },
            { providerRef: { contains: search, mode: 'insensitive' } },
            { sessionId: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          branch: { select: { id: true, code: true, name: true, shortName: true } },
          session: {
            select: {
              id: true,
              status: true,
              currentStep: true,
              totalSteps: true,
              progress: true,
              totalPrice: true,
              createdAt: true,
              machine: { select: { id: true, code: true, name: true, status: true } },
              package: { select: { id: true, code: true, name: true } },
              user: { select: { id: true, displayName: true, phone: true, lineUserId: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return c.json({
      data: payments.map((payment) => mapPaymentSummaryRecord(payment)),
      total,
      page,
      limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payments';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/cashier/payments', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const payload = cashierPaymentSchema.parse(await c.req.json());
    ensureBranchAccess(admin, payload.branchId);

    const result = await prisma.$transaction(async (tx) => {
      const [branch, machine, branchPackageConfig] = await Promise.all([
        tx.branch.findUnique({
          where: { id: payload.branchId },
          select: { id: true, code: true, name: true, shortName: true, isActive: true },
        }),
        tx.machine.findUnique({
          where: { id: payload.machineId },
          select: { id: true, branchId: true, code: true, name: true, status: true, isEnabled: true },
        }),
        tx.branchPackageConfig.findUnique({
          where: {
            branchId_packageId: {
              branchId: payload.branchId,
              packageId: payload.packageId,
            },
          },
          include: { package: true },
        }),
      ]);

      if (!branch || !branch.isActive) {
        throw new Error('Branch not found');
      }
      if (!machine || machine.branchId !== payload.branchId || !machine.isEnabled) {
        throw new Error('Machine is not available');
      }
      if (['maintenance', 'offline'].includes(machine.status)) {
        throw new Error('Machine is not available');
      }

      const activeSession = await tx.washSession.findFirst({
        where: {
          machineId: payload.machineId,
          status: { in: ['pending_payment', 'ready_to_wash', 'in_progress'] },
        },
        select: { id: true },
      });
      if (activeSession) {
        throw new Error('Machine already has an active session');
      }

      if (!branchPackageConfig || !branchPackageConfig.isActive || !branchPackageConfig.isVisible) {
        throw new Error('Package not found');
      }

      const pkg = branchPackageConfig.package;
      const expectedPrice =
        payload.carSize === 'S'
          ? branchPackageConfig.priceOverrideS ?? pkg.priceS
          : payload.carSize === 'M'
            ? branchPackageConfig.priceOverrideM ?? pkg.priceM
            : branchPackageConfig.priceOverrideL ?? pkg.priceL;
      const subtotalPrice = Math.max(expectedPrice, payload.amount);
      const discountAmount = Math.max(subtotalPrice - payload.amount, 0);
      const steps = Array.isArray(pkg.steps) ? pkg.steps : [];

      const normalizedLineUserId = payload.lineUserId?.trim();
      const normalizedPhone = payload.customerPhone?.trim();
      const fallbackName = payload.customerName?.trim() || normalizedPhone || 'Walk-in Customer';
      const fallbackLineUserId = `cashier_${branch.code.toLowerCase()}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      let user =
        normalizedLineUserId
          ? await tx.user.findUnique({ where: { lineUserId: normalizedLineUserId } })
          : normalizedPhone
            ? await tx.user.findFirst({ where: { phone: normalizedPhone } })
            : null;

      if (!user) {
        user = await tx.user.create({
          data: {
            lineUserId: normalizedLineUserId || fallbackLineUserId,
            displayName: fallbackName,
            phone: normalizedPhone || null,
            settings: { create: {} },
            wallet: { create: {} },
          },
        });
      } else if ((payload.customerName || normalizedPhone) && (!user.phone || user.displayName === 'Walk-in Customer')) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            displayName: payload.customerName?.trim() || user.displayName,
            phone: user.phone || normalizedPhone || null,
          },
        });
      }

      const now = new Date();
      const reference = buildCashierReference();
      const receiptImage = payload.receiptImage?.trim() || null;
      const note = payload.note?.trim() || null;
      const provider = payload.paymentMethod === 'cash' ? 'cashier_cash' : 'cashier_manual';
      const metadata = {
        channel: 'cashier',
        cashierAdminId: admin.id,
        cashierAdminEmail: admin.email,
        branchCode: branch.code,
        machineCode: machine.code,
        packageCode: pkg.code,
        expectedPrice,
        amountReceived: payload.amount,
        manualDiscountAmount: discountAmount,
        receiptImage,
        note,
      };

      const session = await tx.washSession.create({
        data: {
          userId: user.id,
          branchId: payload.branchId,
          machineId: payload.machineId,
          packageId: payload.packageId,
          branchPackageConfigId: branchPackageConfig.id,
          scanSource: 'cashier_manual',
          carSize: payload.carSize,
          addons: [],
          subtotalPrice,
          discountAmount,
          totalPrice: payload.amount,
          totalSteps: steps.length,
          status: 'ready_to_wash',
        },
      });

      const payment = await tx.payment.create({
        data: {
          sessionId: session.id,
          userId: user.id,
          branchId: payload.branchId,
          method: payload.paymentMethod,
          status: 'confirmed',
          amount: payload.amount,
          currency: 'THB',
          provider,
          providerRef: reference,
          providerStatus: 'confirmed',
          providerConfirmedAt: now,
          paymentConfirmedSource: 'cashier',
          reference,
          confirmedAt: now,
          metadata,
          attempts: {
            create: {
              status: 'confirmed',
              source: 'admin',
              action: 'cashier_confirm',
              providerRef: reference,
              providerStatus: 'confirmed',
              note: note || 'cashier payment confirmed',
              requestBody: metadata,
              responseBody: { status: 'confirmed', reference },
            },
          },
        },
      });

      await tx.machine.update({
        where: { id: payload.machineId },
        data: { status: 'reserved' },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminUserId: admin.id,
          branchId: payload.branchId,
          action: 'admin.cashier.payment_confirmed',
          entityType: 'payment',
          entityId: payment.id,
          metadata: {
            ...metadata,
            paymentId: payment.id,
            sessionId: session.id,
            userId: user.id,
          },
        },
      });

      return payment.id;
    });

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: result },
      include: {
        branch: { select: { id: true, code: true, name: true, shortName: true } },
        session: {
          select: {
            id: true,
            status: true,
            currentStep: true,
            totalSteps: true,
            progress: true,
            totalPrice: true,
            createdAt: true,
            machine: { select: { id: true, code: true, name: true, status: true } },
            package: { select: { id: true, code: true, name: true } },
            user: { select: { id: true, displayName: true, phone: true, lineUserId: true } },
          },
        },
        attempts: {
          orderBy: { attemptedAt: 'desc' },
          take: 20,
        },
      },
    });

    return c.json({ data: mapPaymentRecord(payment) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: error.issues[0]?.message ?? 'Invalid cashier payload' }, 400);
    }

    const message = error instanceof Error ? error.message : 'Failed to confirm cashier payment';
    const status = message === 'Branch access denied' ? 403 : ['Branch not found', 'Package not found'].includes(message) ? 404 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/payments/:id', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  const paymentId = c.req.param('id');

  if (admin instanceof Response) {
    return admin;
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
          },
        },
        session: {
          select: {
            id: true,
            status: true,
            currentStep: true,
            totalSteps: true,
            progress: true,
            totalPrice: true,
            createdAt: true,
            machine: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
              },
            },
            package: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                displayName: true,
                phone: true,
                lineUserId: true,
              },
            },
          },
        },
        attempts: {
          orderBy: { attemptedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!payment) {
      return c.json({ message: 'Payment not found' }, 404);
    }

    if (
      admin.role !== 'hq_admin' &&
      !admin.branchScopes.some((scope: AdminBranchScope) => scope.branchId === payment.branchId)
    ) {
      return c.json({ message: 'Payment access denied' }, 403);
    }

    return c.json({ data: mapPaymentRecord(payment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payment';
    return c.json({ message }, 400);
  }
});

adminRoutes.post('/payments/:id/reconcile', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  const paymentId = c.req.param('id');

  if (admin instanceof Response) {
    return admin;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, branchId: true },
  });

  if (!payment) {
    return c.json({ message: 'Payment not found' }, 404);
  }

  if (
    admin.role !== 'hq_admin' &&
    !admin.branchScopes.some((scope: AdminBranchScope) => scope.branchId === payment.branchId)
  ) {
    return c.json({ message: 'Payment access denied' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const payload = z
    .object({
      providerStatus: z.string().min(1).optional(),
      providerRef: z.string().min(1).optional(),
      amount: z.number().int().positive().optional(),
      note: z.string().min(1).optional(),
    })
    .parse(body);

  try {
    const session = await reconcilePayment({
      paymentId,
      ...payload,
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.payment.reconcile',
      entityType: 'payment',
      entityId: paymentId,
      branchId: payment.branchId,
      metadata: payload as unknown as Prisma.InputJsonValue,
    });

    return c.json({ data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconcile payment';
    const status = message === 'Payment not found' ? 404 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/payments/:id/verify', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  const paymentId = c.req.param('id');

  if (admin instanceof Response) {
    return admin;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, branchId: true },
  });

  if (!payment) {
    return c.json({ message: 'Payment not found' }, 404);
  }

  if (
    admin.role !== 'hq_admin' &&
    !admin.branchScopes.some((scope: AdminBranchScope) => scope.branchId === payment.branchId)
  ) {
    return c.json({ message: 'Payment access denied' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const payload = z
    .object({
      note: z.string().min(1).optional(),
      providerRef: z.string().min(1).optional(),
    })
    .parse(body);

  try {
    const session = await reconcilePayment({
      paymentId,
      providerRef: payload.providerRef,
      note: payload.note ?? 'admin requested provider verification',
      forceProviderLookup: true,
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.payment.verify',
      entityType: 'payment',
      entityId: paymentId,
      branchId: payment.branchId,
      metadata: {
        providerRef: payload.providerRef ?? null,
        note: payload.note ?? null,
      },
    });

    return c.json({ data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify payment';
    const status = message === 'Payment not found' ? 404 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/customers', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 50);
    const search = c.req.query('search')?.trim();
    const branchId = c.req.query('branchId');
    const { sessionWhere } = buildBranchFilter(admin, branchId);

    const userIds = await prisma.washSession.findMany({
      where: sessionWhere,
      distinct: ['userId'],
      select: { userId: true },
    });

    const scopedUserIds = userIds.map((entry) => entry.userId);
    if (scopedUserIds.length === 0) {
      return c.json({ data: [], total: 0, page, limit });
    }

    const userWhere: Prisma.UserWhereInput = {
      id: { in: scopedUserIds },
    };

    if (search) {
      userWhere.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { lineUserId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          lineUserId: true,
          displayName: true,
          avatarUrl: true,
          phone: true,
          tier: true,
          totalPoints: true,
          createdAt: true,
          vehicles: {
            select: {
              id: true,
              brand: true,
              model: true,
              plate: true,
              province: true,
              color: true,
              size: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          wallet: {
            select: { balance: true },
          },
          sessions: {
            where: sessionWhere,
            select: {
              id: true,
              totalPrice: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: userWhere }),
    ]);

    return c.json({
      data: customers.map((customer) => {
        const confirmedSessions = customer.sessions.filter((session) =>
          ['ready_to_wash', 'in_progress', 'completed'].includes(session.status)
        );
        const lastWash = customer.sessions[0]?.completedAt ?? customer.sessions[0]?.createdAt ?? null;

        return {
          id: customer.id,
          lineUserId: customer.lineUserId,
          displayName: customer.displayName,
          avatarUrl: customer.avatarUrl,
          phone: customer.phone,
          points: customer.wallet?.balance ?? customer.totalPoints,
          totalWashes: confirmedSessions.filter((session) => session.status === 'completed').length,
          totalSpend: confirmedSessions.reduce((sum, session) => sum + session.totalPrice, 0),
          memberTier: customer.tier,
          memberSince: customer.createdAt,
          lastWash,
          vehicles: customer.vehicles.map((vehicle) => ({
            id: vehicle.id,
            brand: vehicle.brand,
            model: vehicle.model,
            plate: vehicle.plate,
            province: vehicle.province,
            color: vehicle.color,
            size: vehicle.size,
            createdAt: vehicle.createdAt,
          })),
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load customers';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/memberships', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const page = Number(c.req.query('page') || 1);
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 100);
    const search = c.req.query('search')?.trim();
    const status = c.req.query('status')?.trim();
    const branchId = c.req.query('branchId');
    const { sessionWhere } = buildBranchFilter(admin, branchId);
    const validStatuses = ['pending', 'active', 'expired', 'cancelled'];

    let scopedUserIds: string[] | null = null;
    if (admin.role !== 'hq_admin' || branchId) {
      const scopedUsers = await prisma.washSession.findMany({
        where: sessionWhere,
        distinct: ['userId'],
        select: { userId: true },
      });
      scopedUserIds = scopedUsers.map((entry) => entry.userId);

      if (scopedUserIds.length === 0) {
        return c.json({
          data: [],
          total: 0,
          page,
          limit,
          summary: {
            totalMembers: 0,
            activeMembers: 0,
            pendingMembers: 0,
            expiredMembers: 0,
            cancelledMembers: 0,
            totalRevenue: 0,
            availableWashCredits: 0,
            availableGrapheneCredits: 0,
          },
        });
      }
    }

    const membershipWhere: Prisma.UserMembershipWhereInput = {
      ...(status && status !== 'all' && validStatuses.includes(status) ? { status: status as any } : {}),
      ...(scopedUserIds ? { userId: { in: scopedUserIds } } : {}),
      ...(search
        ? {
            OR: [
              { paymentReference: { contains: search, mode: 'insensitive' } },
              { user: { displayName: { contains: search, mode: 'insensitive' } } },
              { user: { phone: { contains: search, mode: 'insensitive' } } },
              { user: { lineUserId: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const include = {
      plan: true,
      user: {
        select: {
          id: true,
          lineUserId: true,
          displayName: true,
          avatarUrl: true,
          phone: true,
          tier: true,
          totalWashes: true,
          createdAt: true,
        },
      },
    };

    const [memberships, total, allMemberships] = await Promise.all([
      prisma.userMembership.findMany({
        where: membershipWhere,
        include,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userMembership.count({ where: membershipWhere }),
      prisma.userMembership.findMany({
        where: membershipWhere,
        include: {
          plan: {
            select: {
              washLimit: true,
              grapheneLimit: true,
            },
          },
        },
      }),
    ]);

    const summary = allMemberships.reduce(
      (acc, membership) => {
        acc.totalMembers += 1;
        if (membership.status === 'active') {
          acc.activeMembers += 1;
          acc.availableWashCredits += Math.max(membership.plan.washLimit - membership.washUsed, 0);
          acc.availableGrapheneCredits += Math.max(membership.plan.grapheneLimit - membership.grapheneUsed, 0);
        }
        if (membership.status === 'pending') acc.pendingMembers += 1;
        if (membership.status === 'expired') acc.expiredMembers += 1;
        if (membership.status === 'cancelled') acc.cancelledMembers += 1;
        if (['active', 'expired'].includes(membership.status) && membership.paymentStatus !== 'refunded') {
          acc.totalRevenue += membership.paymentAmount;
        }
        return acc;
      },
      {
        totalMembers: 0,
        activeMembers: 0,
        pendingMembers: 0,
        expiredMembers: 0,
        cancelledMembers: 0,
        totalRevenue: 0,
        availableWashCredits: 0,
        availableGrapheneCredits: 0,
      }
    );

    return c.json({
      data: memberships.map((membership) => ({
        id: membership.id,
        status: membership.status,
        washUsed: membership.washUsed,
        grapheneUsed: membership.grapheneUsed,
        washRemaining: Math.max(membership.plan.washLimit - membership.washUsed, 0),
        grapheneRemaining: Math.max(membership.plan.grapheneLimit - membership.grapheneUsed, 0),
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
        plan: {
          id: membership.plan.id,
          code: membership.plan.code,
          name: membership.plan.name,
          price: membership.plan.price,
          currency: membership.plan.currency,
          washLimit: membership.plan.washLimit,
          grapheneLimit: membership.plan.grapheneLimit,
          freeVacuumPerVisit: membership.plan.freeVacuumPerVisit,
          vipFastLane: membership.plan.vipFastLane,
        },
        user: {
          ...membership.user,
          createdAt: membership.user.createdAt.toISOString(),
        },
      })),
      total,
      page,
      limit,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load memberships';
    const statusCode = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, statusCode);
  }
});

adminRoutes.get('/stamps', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const page = Number(c.req.query('page') || 1);
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 100);
    const search = c.req.query('search')?.trim();
    const branchId = c.req.query('branchId');
    const { sessionWhere } = buildBranchFilter(admin, branchId);
    const scopedBranchIds =
      branchId ? [branchId] : admin.role === 'hq_admin' ? null : admin.branchScopes.map((scope) => scope.branchId);

    const scopedUsers = await prisma.washSession.findMany({
      where: sessionWhere,
      distinct: ['userId'],
      select: { userId: true },
    });
    const scopedUserIds = scopedUsers.map((entry) => entry.userId);

    if (scopedUserIds.length === 0) {
      return c.json({
        data: [],
        total: 0,
        page,
        limit,
        summary: {
          totalCustomers: 0,
          activeCards: 0,
          readyToClaim: 0,
          totalCurrentStamps: 0,
          totalEarnedInScope: 0,
        },
      });
    }

    const userWhere: Prisma.UserWhereInput = {
      id: { in: scopedUserIds },
    };

    if (search) {
      userWhere.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { lineUserId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          lineUserId: true,
          displayName: true,
          avatarUrl: true,
          phone: true,
          tier: true,
          totalPoints: true,
          createdAt: true,
          stamps: {
            where: { rewardClaimed: false },
            select: {
              id: true,
              currentCount: true,
              targetCount: true,
              rewardClaimed: true,
              lastStampAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          sessions: {
            where: sessionWhere,
            select: {
              id: true,
              totalPrice: true,
              status: true,
              createdAt: true,
              completedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          wallet: {
            select: { balance: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: userWhere }),
    ]);

    const pageUserIds = customers.map((customer) => customer.id);
    const stampTransactionWhere: Prisma.StampTransactionWhereInput = {
      userId: { in: pageUserIds },
      voidedAt: null,
      ...(scopedBranchIds ? { branchId: { in: scopedBranchIds } } : {}),
    };

    const [transactions, claimedGroups] = await Promise.all([
      pageUserIds.length
        ? prisma.stampTransaction.findMany({
            where: stampTransactionWhere,
            include: {
              branch: { select: { id: true, name: true, shortName: true } },
              package: { select: { id: true, code: true, name: true } },
              session: { select: { id: true, completedAt: true, totalPrice: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: pageUserIds.length * 5,
          })
        : Promise.resolve([]),
      pageUserIds.length
        ? prisma.stamp.groupBy({
            by: ['userId'],
            where: { userId: { in: pageUserIds }, rewardClaimed: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const transactionsByUser = new Map<string, typeof transactions>();
    for (const transaction of transactions) {
      const current = transactionsByUser.get(transaction.userId) ?? [];
      if (current.length < 5) {
        current.push(transaction);
        transactionsByUser.set(transaction.userId, current);
      }
    }

    const claimedCountByUser = new Map(claimedGroups.map((group) => [group.userId, group._count._all]));

    const data = customers.map((customer) => {
      const activeStamp = customer.stamps[0] ?? null;
      const scopedTransactions = transactionsByUser.get(customer.id) ?? [];
      const confirmedSessions = customer.sessions.filter((session) =>
        ['ready_to_wash', 'in_progress', 'completed'].includes(session.status)
      );
      const completedSessions = confirmedSessions.filter((session) => session.status === 'completed');
      const lastWash = customer.sessions[0]?.completedAt ?? customer.sessions[0]?.createdAt ?? null;
      const targetCount = activeStamp?.targetCount ?? STAMP_TARGET_COUNT;
      const currentCount = activeStamp?.currentCount ?? 0;

      return {
        user: {
          id: customer.id,
          lineUserId: customer.lineUserId,
          displayName: customer.displayName,
          avatarUrl: customer.avatarUrl,
          phone: customer.phone,
          points: customer.wallet?.balance ?? customer.totalPoints,
          memberTier: customer.tier,
          memberSince: customer.createdAt.toISOString(),
        },
        stamp: activeStamp
          ? {
              ...activeStamp,
              lastStampAt: activeStamp.lastStampAt?.toISOString() ?? null,
              createdAt: activeStamp.createdAt.toISOString(),
            }
          : null,
        currentCount,
        targetCount,
        progressPercent: targetCount > 0 ? Math.round((currentCount / targetCount) * 100) : 0,
        readyToClaim: currentCount >= targetCount,
        claimedRewards: claimedCountByUser.get(customer.id) ?? 0,
        earnedInScope: scopedTransactions.reduce((sum, transaction) => sum + transaction.stampCount, 0),
        totalWashesInScope: completedSessions.length,
        totalSpendInScope: confirmedSessions.reduce((sum, session) => sum + session.totalPrice, 0),
        lastWash: lastWash?.toISOString() ?? null,
        recentTransactions: scopedTransactions.map((transaction) => ({
          id: transaction.id,
          stampCount: transaction.stampCount,
          rawStampCount: transaction.rawStampCount,
          reason: transaction.reason,
          createdAt: transaction.createdAt.toISOString(),
          voidedAt: transaction.voidedAt?.toISOString() ?? null,
          branch: transaction.branch,
          package: transaction.package,
          session: {
            ...transaction.session,
            completedAt: transaction.session.completedAt?.toISOString() ?? null,
          },
        })),
      };
    });

    return c.json({
      data,
      total,
      page,
      limit,
      summary: {
        totalCustomers: total,
        activeCards: data.filter((item) => item.stamp).length,
        readyToClaim: data.filter((item) => item.readyToClaim).length,
        totalCurrentStamps: data.reduce((sum, item) => sum + item.currentCount, 0),
        totalEarnedInScope: data.reduce((sum, item) => sum + item.earnedInScope, 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load stamp customers';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/stamps/:userId/history', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const userId = c.req.param('userId');
    const branchId = c.req.query('branchId');
    const { sessionWhere } = buildBranchFilter(admin, branchId);
    const scopedBranchIds =
      branchId ? [branchId] : admin.role === 'hq_admin' ? null : admin.branchScopes.map((scope) => scope.branchId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, lineUserId: true, phone: true },
    });
    if (!user) {
      return c.json({ message: 'Customer not found' }, 404);
    }

    const scopedSessionCount = await prisma.washSession.count({ where: { ...sessionWhere, userId } });
    if (admin.role !== 'hq_admin' || branchId) {
      if (scopedSessionCount === 0) {
        return c.json({ message: 'Customer is outside admin scope' }, 403);
      }
    }

    const [transactions, adjustments] = await Promise.all([
      prisma.stampTransaction.findMany({
        where: {
          userId,
          ...(scopedBranchIds ? { branchId: { in: scopedBranchIds } } : {}),
        },
        include: {
          branch: { select: { id: true, name: true, shortName: true } },
          package: { select: { id: true, code: true, name: true } },
          session: { select: { id: true, completedAt: true, totalPrice: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.auditLog.findMany({
        where: {
          entityType: 'stamp',
          entityId: userId,
        },
        include: {
          adminUser: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return c.json({
      data: {
        user,
        transactions: transactions.map((transaction) => ({
          id: transaction.id,
          stampId: transaction.stampId,
          sessionId: transaction.sessionId,
          stampCount: transaction.stampCount,
          rawStampCount: transaction.rawStampCount,
          reason: transaction.reason,
          metadata: transaction.metadata,
          voidedAt: transaction.voidedAt?.toISOString() ?? null,
          createdAt: transaction.createdAt.toISOString(),
          branch: transaction.branch,
          package: transaction.package,
          session: {
            ...transaction.session,
            completedAt: transaction.session.completedAt?.toISOString() ?? null,
          },
        })),
        adjustments: adjustments.map(mapAuditLogRecord),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load stamp history';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/stamps/:userId/adjust', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const userId = c.req.param('userId');
    const branchId = c.req.query('branchId');
    const payload = stampAdjustmentSchema.parse(await c.req.json());

    if (
      admin.role !== 'hq_admin' &&
      !admin.branchScopes.some((scope) => (!branchId || scope.branchId === branchId) && scope.canManageCoupons)
    ) {
      return c.json({ message: 'Admin cannot manage stamp rewards in this branch scope' }, 403);
    }

    const { sessionWhere } = buildBranchFilter(admin, branchId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });
    if (!user) {
      return c.json({ message: 'Customer not found' }, 404);
    }

    const scopedSessionCount = await prisma.washSession.count({ where: { ...sessionWhere, userId } });
    if (admin.role !== 'hq_admin' || branchId) {
      if (scopedSessionCount === 0) {
        return c.json({ message: 'Customer is outside admin scope' }, 403);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingStamp = await tx.stamp.findFirst({
        where: { userId, rewardClaimed: false },
        orderBy: { createdAt: 'desc' },
      });
      const stamp =
        existingStamp ??
        (await tx.stamp.create({
          data: { userId, targetCount: STAMP_TARGET_COUNT },
        }));

      const beforeCount = stamp.currentCount;
      const afterCount = Math.min(stamp.targetCount, Math.max(0, beforeCount + payload.delta));
      const updatedStamp = await tx.stamp.update({
        where: { id: stamp.id },
        data: {
          currentCount: afterCount,
          lastStampAt: payload.delta > 0 ? new Date() : stamp.lastStampAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminUserId: admin.id,
          branchId: branchId ?? null,
          action: 'admin.stamp.adjust',
          entityType: 'stamp',
          entityId: userId,
          metadata: {
            stampId: stamp.id,
            userId,
            customerName: user.displayName,
            delta: payload.delta,
            beforeCount,
            afterCount,
            targetCount: stamp.targetCount,
            reason: payload.reason,
          },
        },
      });

      return {
        beforeCount,
        afterCount,
        stamp: updatedStamp,
      };
    });

    return c.json({
      data: {
        message: 'Stamp adjusted and audit log recorded',
        beforeCount: result.beforeCount,
        afterCount: result.afterCount,
        stamp: {
          id: result.stamp.id,
          userId: result.stamp.userId,
          currentCount: result.stamp.currentCount,
          targetCount: result.stamp.targetCount,
          rewardClaimed: result.stamp.rewardClaimed,
          lastStampAt: result.stamp.lastStampAt?.toISOString() ?? null,
          createdAt: result.stamp.createdAt.toISOString(),
          updatedAt: result.stamp.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: error.issues[0]?.message ?? 'Invalid stamp adjustment payload' }, 400);
    }

    const message = error instanceof Error ? error.message : 'Failed to adjust stamp';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/meta', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  const [accessibleBranches, availableRoles] = await Promise.all([
    prisma.branch.findMany({
      where: getBranchWhereClause(admin.role, admin.branchScopes),
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        isActive: true,
      },
    }),
    Promise.resolve(['hq_admin', 'branch_admin']),
  ]);

  return c.json({
    data: {
      machineStatuses,
      sessionStatuses,
      paymentStatuses,
      admin: mapAdminIdentity(admin),
      availableRoles,
      branches: accessibleBranches,
    },
  });
});

adminRoutes.get('/coupons', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const status = c.req.query('status');
    const scope = c.req.query('scope');
    const search = c.req.query('search')?.trim();
    const includeArchived = c.req.query('includeArchived') === 'true';
    const scopedBranchId = ensureCouponManagementAccess(admin, branchId);
    const manageableBranchIds = getCouponManageableBranchIds(admin);

    const filters: Prisma.CouponWhereInput[] = [];

    if (status) {
      filters.push({ status: status as CouponStatus });
    } else if (!includeArchived) {
      filters.push({ status: { not: 'archived' } });
    }

    if (scope) {
      filters.push({ scope: scope as CouponScope });
    }

    if (search) {
      filters.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (scopedBranchId) {
      if (admin.role === 'hq_admin') {
        filters.push({
          OR: [{ scope: 'all_branches' }, { branches: { some: { branchId: scopedBranchId } } }],
        });
      } else {
        filters.push({ branches: { some: { branchId: scopedBranchId } } });
      }
    } else if (manageableBranchIds && manageableBranchIds.length > 0) {
      filters.push({ branches: { some: { branchId: { in: manageableBranchIds } } } });
    }

    const coupons = await prisma.coupon.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      include: {
        branches: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
          orderBy: [{ branchId: 'asc' }],
        },
        _count: {
          select: {
            users: true,
            redemptions: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const manageableCoupons = coupons.filter((coupon) => {
      if (!canManageCouponRecord(admin, coupon)) {
        return false;
      }

      if (!scopedBranchId) {
        return true;
      }

      return coupon.scope === 'all_branches' || coupon.branches.some((item) => item.branchId === scopedBranchId);
    });

    const branchUsage = manageableCoupons.length
      ? await prisma.couponRedemption.groupBy({
          by: ['couponId', 'branchId'],
          where: {
            couponId: { in: manageableCoupons.map((coupon) => coupon.id) },
            ...(scopedBranchId
              ? { branchId: scopedBranchId }
              : manageableBranchIds
                ? { branchId: { in: manageableBranchIds } }
                : {}),
          },
          _count: { _all: true },
        })
      : [];

    const redemptionSummary = branchUsage.reduce<Record<string, Array<{ branchId: string; usedCount: number }>>>(
      (accumulator, item) => {
        accumulator[item.couponId] ??= [];
        accumulator[item.couponId].push({
          branchId: item.branchId,
          usedCount: item._count._all,
        });
        return accumulator;
      },
      {}
    );

    return c.json({
      data: manageableCoupons.map((coupon) => mapAdminCoupon(coupon, redemptionSummary)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load coupons';
    const status =
      message === 'Coupon management access denied'
        ? 403
        : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/coupon-payment-accounts', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const scopedBranchId = branchId ? ensureCouponManagementAccess(admin, branchId) : null;
    const manageableBranchIds = getCouponManageableBranchIds(admin);

    const filters: Prisma.CouponPaymentAccountWhereInput[] = [];
    if (scopedBranchId) {
      filters.push({
        OR: [{ accountType: 'hq', isActive: true }, { branchId: scopedBranchId }],
      });
    } else if (manageableBranchIds && manageableBranchIds.length > 0) {
      filters.push({
        OR: [{ accountType: 'hq', isActive: true }, { branchId: { in: manageableBranchIds } }],
      });
    }

    const accounts = await prisma.couponPaymentAccount.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            purchases: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { accountType: 'asc' }, { updatedAt: 'desc' }],
    });

    return c.json({ data: accounts.map(mapAdminCouponPaymentAccount) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load coupon payment accounts';
    const status = message === 'Coupon management access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/coupon-payment-accounts', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const payload = couponPaymentAccountSchema.parse(await c.req.json());
    const branchId = resolveCouponPaymentAccountBranch(admin, payload.accountType, payload.branchId);
    const isDefault = payload.isDefault ?? false;
    const code =
      payload.code?.trim().toUpperCase() ??
      buildCouponPaymentAccountCode(payload.accountType, branchId, payload.displayName);

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.couponPaymentAccount.updateMany({
          where: payload.accountType === 'hq' ? { accountType: 'hq' } : { accountType: 'branch', branchId },
          data: { isDefault: false },
        });
      }

      return tx.couponPaymentAccount.create({
        data: {
          code,
          displayName: payload.displayName.trim(),
          accountType: payload.accountType,
          branchId,
          promptPayId: payload.promptPayId.trim(),
          promptPayName: payload.promptPayName.trim(),
          bankName: payload.bankName?.trim() || null,
          accountName: payload.accountName?.trim() || null,
          accountNumber: payload.accountNumber?.trim() || null,
          isActive: payload.isActive ?? true,
          isDefault,
        },
        include: {
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
              shortName: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              purchases: true,
            },
          },
        },
      });
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.coupon_payment_account.create',
      entityType: 'coupon_payment_account',
      entityId: created.id,
      branchId: created.branchId,
      metadata: {
        code: created.code,
        accountType: created.accountType,
        promptPayId: created.promptPayId,
        promptPayName: created.promptPayName,
        isDefault: created.isDefault,
      },
    });

    return c.json({ data: mapAdminCouponPaymentAccount(created) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create coupon payment account';
    const status =
      message === 'Only HQ can manage central coupon payment accounts' ||
      message === 'Branch payment accounts require branchId' ||
      message === 'Coupon management access denied'
        ? 403
        : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/coupon-payment-accounts/:id', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const accountId = c.req.param('id');
    const payload = updateCouponPaymentAccountSchema.parse(await c.req.json());
    const existing = await prisma.couponPaymentAccount.findUnique({
      where: { id: accountId },
    });

    if (!existing) {
      return c.json({ message: 'Coupon payment account not found' }, 404);
    }

    if (!canManageCouponPaymentAccount(admin, existing)) {
      return c.json({ message: 'Coupon payment account access denied' }, 403);
    }

    const nextAccountType = payload.accountType ?? existing.accountType;
    const nextBranchId = resolveCouponPaymentAccountBranch(
      admin,
      nextAccountType,
      payload.branchId === undefined ? existing.branchId : payload.branchId
    );
    const nextIsDefault = payload.isDefault ?? existing.isDefault;

    const updated = await prisma.$transaction(async (tx) => {
      if (nextIsDefault) {
        await tx.couponPaymentAccount.updateMany({
          where: nextAccountType === 'hq' ? { accountType: 'hq' } : { accountType: 'branch', branchId: nextBranchId },
          data: { isDefault: false },
        });
      }

      return tx.couponPaymentAccount.update({
        where: { id: accountId },
        data: {
          code: payload.code?.trim().toUpperCase(),
          displayName: payload.displayName?.trim(),
          accountType: payload.accountType,
          branchId: nextBranchId,
          promptPayId: payload.promptPayId?.trim(),
          promptPayName: payload.promptPayName?.trim(),
          bankName: payload.bankName === undefined ? undefined : payload.bankName?.trim() || null,
          accountName: payload.accountName === undefined ? undefined : payload.accountName?.trim() || null,
          accountNumber: payload.accountNumber === undefined ? undefined : payload.accountNumber?.trim() || null,
          isActive: payload.isActive,
          isDefault: nextIsDefault,
        },
        include: {
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
              shortName: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              purchases: true,
            },
          },
        },
      });
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.coupon_payment_account.update',
      entityType: 'coupon_payment_account',
      entityId: updated.id,
      branchId: updated.branchId,
      metadata: {
        updatedFields: Object.keys(payload),
        code: updated.code,
        accountType: updated.accountType,
        isActive: updated.isActive,
        isDefault: updated.isDefault,
      },
    });

    return c.json({ data: mapAdminCouponPaymentAccount(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update coupon payment account';
    const status =
      message === 'Only HQ can manage central coupon payment accounts' ||
      message === 'Branch payment accounts require branchId' ||
      message === 'Coupon payment account access denied' ||
      message === 'Coupon management access denied'
        ? 403
        : message === 'Coupon payment account not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/coupon-purchases', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const status = c.req.query('status') as CouponPurchaseStatus | 'all' | undefined;
    const search = c.req.query('search')?.trim();
    const scopedBranchId = ensureCouponManagementAccess(admin, branchId);
    const manageableBranchIds = getCouponManageableBranchIds(admin);

    const filters: Prisma.CouponPurchaseWhereInput[] = [];

    if (status && status !== 'all') {
      filters.push({ status });
    }

    if (scopedBranchId) {
      filters.push({ branchId: scopedBranchId });
    } else if (manageableBranchIds && manageableBranchIds.length > 0) {
      filters.push({ branchId: { in: manageableBranchIds } });
    }

    if (search) {
      filters.push({
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { coupon: { is: { code: { contains: search, mode: 'insensitive' } } } },
          { coupon: { is: { title: { contains: search, mode: 'insensitive' } } } },
          { user: { is: { displayName: { contains: search, mode: 'insensitive' } } } },
          { user: { is: { phone: { contains: search, mode: 'insensitive' } } } },
          { user: { is: { lineUserId: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    const purchases = await prisma.couponPurchase.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      include: adminCouponPurchaseInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });

    return c.json({
      data: purchases.filter((purchase) => canManageCouponPurchaseRecord(admin, purchase)).map(mapAdminCouponPurchase),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load coupon purchases';
    const statusCode = message === 'Coupon management access denied' ? 403 : 400;
    return c.json({ message }, statusCode);
  }
});

adminRoutes.post('/coupon-purchases/:id/approve', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const purchaseId = c.req.param('id');
    const payload = couponPurchaseDecisionSchema.parse(await c.req.json().catch(() => ({})));
    const existing = await prisma.couponPurchase.findUnique({
      where: { id: purchaseId },
      include: adminCouponPurchaseInclude,
    });

    if (!existing) {
      return c.json({ message: 'Coupon purchase not found' }, 404);
    }

    if (!canManageCouponPurchaseRecord(admin, existing)) {
      return c.json({ message: 'Coupon purchase access denied' }, 403);
    }

    if (existing.status === 'confirmed') {
      return c.json({ data: mapAdminCouponPurchase(existing) });
    }

    if (!['pending_transfer', 'pending_review'].includes(existing.status)) {
      return c.json({ message: `Coupon purchase is ${existing.status} and cannot be approved` }, 400);
    }

    if (!existing.slipUploadedAt) {
      return c.json({ message: 'Slip must be uploaded before approval' }, 400);
    }

    const checklist = {
      amountMatches: payload.amountMatches === true,
      referenceMatches: payload.referenceMatches === true,
      accountMatches: payload.accountMatches === true,
      reviewedAt: new Date().toISOString(),
      reviewedByAdminId: admin.id,
    };

    if (!checklist.amountMatches || !checklist.referenceMatches || !checklist.accountMatches) {
      return c.json({ message: 'Amount, reference, and receiving account must be checked before approval' }, 400);
    }

    if (existing.coupon.status !== 'active') {
      return c.json({ message: 'Coupon is not active' }, 400);
    }

    if (new Date() < existing.coupon.validFrom || new Date() > existing.coupon.validUntil) {
      return c.json({ message: 'Coupon is not valid at this time' }, 400);
    }

    if (existing.coupon.maxUses > 0 && existing.coupon.usedCount >= existing.coupon.maxUses) {
      return c.json({ message: 'Coupon usage limit reached' }, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const duplicateUserCoupon = await tx.userCoupon.findUnique({
        where: {
          userId_couponId: {
            userId: existing.userId,
            couponId: existing.couponId,
          },
        },
        select: { id: true },
      });

      if (duplicateUserCoupon) {
        throw new Error('Customer already owns this coupon');
      }

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId: existing.userId,
          couponId: existing.couponId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminUserId: admin.id,
          branchId: existing.branchId,
          action: 'admin.coupon_purchase.approve',
          entityType: 'coupon_purchase',
          entityId: existing.id,
          metadata: {
            userId: existing.userId,
            couponId: existing.couponId,
            couponCode: existing.coupon.code,
            amount: existing.amount,
            reference: existing.reference,
            issuedUserCouponId: userCoupon.id,
            reviewChecklist: checklist,
            adminNote: payload.adminNote ?? null,
          },
        },
      });

      return tx.couponPurchase.update({
        where: { id: existing.id },
        data: {
          status: 'confirmed',
          issuedUserCouponId: userCoupon.id,
          reviewedByAdminId: admin.id,
          adminNote: payload.adminNote?.trim() || null,
          reviewChecklist: checklist,
          confirmedAt: new Date(),
        },
        include: adminCouponPurchaseInclude,
      });
    });

    return c.json({ data: mapAdminCouponPurchase(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve coupon purchase';
    return c.json({ message }, message === 'Customer already owns this coupon' ? 400 : 500);
  }
});

adminRoutes.post('/coupon-purchases/:id/reject', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const purchaseId = c.req.param('id');
    const payload = couponPurchaseDecisionSchema.parse(await c.req.json().catch(() => ({})));
    const existing = await prisma.couponPurchase.findUnique({
      where: { id: purchaseId },
      include: adminCouponPurchaseInclude,
    });

    if (!existing) {
      return c.json({ message: 'Coupon purchase not found' }, 404);
    }

    if (!canManageCouponPurchaseRecord(admin, existing)) {
      return c.json({ message: 'Coupon purchase access denied' }, 403);
    }

    if (existing.status === 'confirmed') {
      return c.json({ message: 'Confirmed coupon purchases cannot be rejected' }, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminUserId: admin.id,
          branchId: existing.branchId,
          action: 'admin.coupon_purchase.reject',
          entityType: 'coupon_purchase',
          entityId: existing.id,
          metadata: {
            userId: existing.userId,
            couponId: existing.couponId,
            couponCode: existing.coupon.code,
            amount: existing.amount,
            reference: existing.reference,
            adminNote: payload.adminNote ?? null,
          },
        },
      });

      return tx.couponPurchase.update({
        where: { id: existing.id },
        data: {
          status: 'rejected',
          reviewedByAdminId: admin.id,
          adminNote: payload.adminNote?.trim() || null,
          rejectedAt: new Date(),
        },
        include: adminCouponPurchaseInclude,
      });
    });

    return c.json({ data: mapAdminCouponPurchase(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject coupon purchase';
    return c.json({ message }, 400);
  }
});

adminRoutes.post('/coupons', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const payload = createCouponSchema.parse(await c.req.json());
    const branchIds = resolveCouponBranchAssignments(admin, payload.scope, payload.branchIds);
    const packageIds = Array.from(new Set(payload.packageIds));
    const nextStatus: CouponStatus = payload.status ?? 'active';

    if (admin.role !== 'hq_admin' && nextStatus === 'archived') {
      throw new Error('Branch admins cannot create archived coupons');
    }

    await validateCouponReferences({ packageIds, branchIds });

    const created = await prisma.coupon.create({
      data: {
        code: payload.code.trim().toUpperCase(),
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        scope: payload.scope,
        status: nextStatus,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        minSpend: payload.minSpend,
        maxUses: payload.maxUses,
        maxUsesPerUser: payload.maxUsesPerUser,
        isPurchasable: payload.isPurchasable,
        purchasePrice: payload.isPurchasable ? payload.purchasePrice : 0,
        packageIds,
        validFrom: payload.validFrom,
        validUntil: payload.validUntil,
        branches: branchIds.length
          ? {
              createMany: {
                data: branchIds.map((assignedBranchId) => ({
                  branchId: assignedBranchId,
                })),
              },
            }
          : undefined,
      },
      include: {
        branches: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
            redemptions: true,
          },
        },
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.coupon.create',
      entityType: 'coupon',
      entityId: created.id,
      branchId: payload.scope === 'branch_only' ? branchIds[0] : null,
      metadata: {
        code: created.code,
        scope: created.scope,
        status: created.status,
        branchIds,
      },
    });

    return c.json({ data: mapAdminCoupon(created, {}) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create coupon';
    const status =
      message === 'Only HQ can create all-branch coupons' ||
      message === 'Coupon branch assignment is outside admin scope' ||
      message === 'Branch admins cannot create archived coupons'
        ? 403
        : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/coupons/:id', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const couponId = c.req.param('id');
    const payload = updateCouponSchema.parse(await c.req.json());
    const existing = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        branches: {
          select: {
            branchId: true,
          },
        },
      },
    });

    if (!existing) {
      return c.json({ message: 'Coupon not found' }, 404);
    }

    if (!canManageCouponRecord(admin, existing)) {
      return c.json({ message: 'Coupon management access denied' }, 403);
    }

    const nextScope = payload.scope ?? existing.scope;
    const nextBranchIds = resolveCouponBranchAssignments(
      admin,
      nextScope,
      payload.branchIds ?? existing.branches.map((item) => item.branchId)
    );
    const nextPackageIds = payload.packageIds ? Array.from(new Set(payload.packageIds)) : existing.packageIds;
    const nextStatus = payload.status ?? existing.status;
    const nextValidFrom = payload.validFrom ?? existing.validFrom;
    const nextValidUntil = payload.validUntil ?? existing.validUntil;
    const nextIsPurchasable = payload.isPurchasable ?? existing.isPurchasable;
    const nextPurchasePrice =
      payload.purchasePrice === undefined
        ? nextIsPurchasable
          ? existing.purchasePrice
          : 0
        : payload.purchasePrice;

    if (admin.role !== 'hq_admin' && nextStatus === 'archived') {
      throw new Error('Branch admins cannot archive coupons');
    }

    if (nextValidUntil <= nextValidFrom) {
      throw new Error('validUntil must be later than validFrom');
    }

    if (nextIsPurchasable && nextPurchasePrice <= 0) {
      throw new Error('Purchasable coupons require a purchase price');
    }

    await validateCouponReferences({
      packageIds: nextPackageIds,
      branchIds: nextBranchIds,
    });

    await prisma.$transaction(async (tx) => {
      await tx.couponBranchLink.deleteMany({
        where: { couponId },
      });

      if (nextBranchIds.length) {
        await tx.couponBranchLink.createMany({
          data: nextBranchIds.map((assignedBranchId) => ({
            couponId,
            branchId: assignedBranchId,
          })),
        });
      }

      await tx.coupon.update({
        where: { id: couponId },
        data: {
          code: payload.code ? payload.code.trim().toUpperCase() : undefined,
          title: payload.title?.trim(),
          description:
            payload.description === undefined ? undefined : payload.description?.trim() || null,
          scope: nextScope,
          status: nextStatus,
          discountType: payload.discountType,
          discountValue: payload.discountValue,
          minSpend: payload.minSpend,
          maxUses: payload.maxUses,
          maxUsesPerUser: payload.maxUsesPerUser,
          isPurchasable: payload.isPurchasable,
          purchasePrice:
            payload.isPurchasable === false
              ? 0
              : payload.purchasePrice === undefined
                ? undefined
                : payload.purchasePrice,
          packageIds: nextPackageIds,
          validFrom: payload.validFrom,
          validUntil: payload.validUntil,
        },
      });
    });

    const updated = await prisma.coupon.findUniqueOrThrow({
      where: { id: couponId },
      include: {
        branches: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
          orderBy: [{ branchId: 'asc' }],
        },
        _count: {
          select: {
            users: true,
            redemptions: true,
          },
        },
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.coupon.update',
      entityType: 'coupon',
      entityId: updated.id,
      branchId: updated.scope === 'branch_only' ? nextBranchIds[0] : null,
      metadata: {
        updatedFields: Object.keys(payload),
        scope: updated.scope,
        status: updated.status,
        branchIds: nextBranchIds,
      },
    });

    return c.json({ data: mapAdminCoupon(updated, {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update coupon';
    const status =
      message === 'Coupon management access denied' ||
      message === 'Only HQ can create all-branch coupons' ||
      message === 'Coupon branch assignment is outside admin scope' ||
      message === 'Branch admins cannot archive coupons'
        ? 403
        : message === 'Coupon not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/coupons/:id/activation', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const couponId = c.req.param('id');
    const payload = couponActivationSchema.parse(await c.req.json());
    const existing = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        branches: {
          select: {
            branchId: true,
          },
        },
      },
    });

    if (!existing) {
      return c.json({ message: 'Coupon not found' }, 404);
    }

    if (!canManageCouponRecord(admin, existing)) {
      return c.json({ message: 'Coupon management access denied' }, 403);
    }

    const updated = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        status: payload.isActive ? 'active' : 'inactive',
      },
      include: {
        branches: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
            redemptions: true,
          },
        },
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.coupon.activation',
      entityType: 'coupon',
      entityId: updated.id,
      branchId: updated.scope === 'branch_only' ? updated.branches[0]?.branchId ?? null : null,
      metadata: {
        status: updated.status,
      },
    });

    return c.json({ data: mapAdminCoupon(updated, {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update coupon activation';
    const status =
      message === 'Coupon management access denied'
        ? 403
        : message === 'Coupon not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/packages', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const includeInactive = c.req.query('includeInactive') === 'true';
    const scopedBranchId = ensureBranchAccess(admin, branchId);
    const accessibleBranchIds = admin.branchScopes.map((scope: AdminBranchScope) => scope.branchId);

    let branchConfigWhere: Prisma.BranchPackageConfigWhereInput | undefined;
    if (scopedBranchId) {
      branchConfigWhere = { branchId: scopedBranchId };
    } else if (admin.role !== 'hq_admin') {
      branchConfigWhere = { branchId: { in: accessibleBranchIds } };
    }

    const packages = await prisma.washPackage.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        branchConfigs: {
          where: branchConfigWhere,
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
          orderBy: [{ branchId: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return c.json({
      data: packages.map((pkg) => mapAdminPackage(pkg)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load packages';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/packages', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    ensureHqRole(admin);
    const payload = createPackageSchema.parse(await c.req.json());

    const created = await prisma.washPackage.create({
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description ?? null,
        vehicleType: payload.vehicleType,
        priceS: payload.priceS,
        priceM: payload.priceM,
        priceL: payload.priceL,
        steps: payload.steps,
        stepDuration: payload.stepDuration,
        features: toNullableJsonInput(payload.features ?? null),
        image: payload.image ?? null,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      },
    });

    const createdRecord = await prisma.washPackage.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        branchConfigs: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.package.create',
      entityType: 'wash_package',
      entityId: created.id,
      metadata: {
        code: created.code,
        vehicleType: created.vehicleType,
      },
    });

    return c.json(
      {
        data: mapAdminPackage(createdRecord),
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create package';
    const status = message === 'Only HQ can manage global packages' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/packages/:id', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    ensureHqRole(admin);
    const packageId = c.req.param('id');
    const payload = updatePackageSchema.parse(await c.req.json());

    const updated = await prisma.washPackage.update({
      where: { id: packageId },
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        vehicleType: payload.vehicleType,
        priceS: payload.priceS,
        priceM: payload.priceM,
        priceL: payload.priceL,
        steps: payload.steps,
        stepDuration: payload.stepDuration,
        features: toNullableJsonInput(payload.features),
        image: payload.image,
        sortOrder: payload.sortOrder,
        isActive: payload.isActive,
      },
    });

    const updatedRecord = await prisma.washPackage.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        branchConfigs: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.package.update',
      entityType: 'wash_package',
      entityId: updated.id,
      metadata: {
        updatedFields: Object.keys(payload),
      },
    });

    return c.json({
      data: mapAdminPackage(updatedRecord),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update package';
    const status =
      message === 'Only HQ can manage global packages'
        ? 403
        : message === 'No WashPackage found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/packages/:id/activation', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    ensureHqRole(admin);
    const packageId = c.req.param('id');
    const payload = packageActivationSchema.parse(await c.req.json());

    const updated = await prisma.washPackage.update({
      where: { id: packageId },
      data: {
        isActive: payload.isActive,
      },
    });

    const updatedRecord = await prisma.washPackage.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        branchConfigs: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: payload.isActive ? 'admin.package.activate' : 'admin.package.deactivate',
      entityType: 'wash_package',
      entityId: updated.id,
    });

    return c.json({
      data: mapAdminPackage(updatedRecord),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update package activation';
    const status =
      message === 'Only HQ can manage global packages'
        ? 403
        : message === 'No WashPackage found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/packages/:id/branches/:branchId', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const packageId = c.req.param('id');
    const branchId = c.req.param('branchId');
    ensureBranchAccess(admin, branchId);
    const payload = branchPackageConfigSchema.parse(await c.req.json());

    const [pkg, branch] = await Promise.all([
      prisma.washPackage.findUnique({
        where: { id: packageId },
      }),
      prisma.branch.findUnique({
        where: { id: branchId },
        select: {
          id: true,
          code: true,
          name: true,
          shortName: true,
          isActive: true,
        },
      }),
    ]);

    if (!pkg) {
      return c.json({ message: 'Package not found' }, 404);
    }

    if (!branch) {
      return c.json({ message: 'Branch not found' }, 404);
    }

    await prisma.branchPackageConfig.upsert({
      where: {
        branchId_packageId: {
          branchId,
          packageId,
        },
      },
      update: payload,
      create: {
        branchId,
        packageId,
        isActive: payload.isActive ?? true,
        isVisible: payload.isVisible ?? true,
        displayName: payload.displayName ?? null,
        descriptionOverride: payload.descriptionOverride ?? null,
        priceOverrideS: payload.priceOverrideS,
        priceOverrideM: payload.priceOverrideM,
        priceOverrideL: payload.priceOverrideL,
      },
    });

    const updatedPackage = await prisma.washPackage.findUniqueOrThrow({
      where: { id: packageId },
      include: {
        branchConfigs: {
          where: { branchId },
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.package.branch_config.update',
      entityType: 'branch_package_config',
      entityId: `${branchId}:${packageId}`,
      branchId,
      metadata: {
        packageId,
        branchId,
        updatedFields: Object.keys(payload),
      },
    });

    return c.json({
      data: {
        package: mapAdminPackage(updatedPackage),
        branch,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update branch package configuration';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/payment-configs', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const branchId = c.req.query('branchId');
    const scopedBranchId = ensureBranchAccess(admin, branchId);
    const branchWhere =
      scopedBranchId
        ? { id: scopedBranchId }
        : getBranchWhereClause(admin.role, admin.branchScopes);

    const configs = await (prisma as any).branchPaymentConfig.findMany({
      where: {
        branch: branchWhere,
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        credentials: {
          orderBy: { key: 'asc' },
        },
        capabilities: true,
      },
      orderBy: [{ branchId: 'asc' }, { isActive: 'desc' }, { createdAt: 'asc' }],
    });

    return c.json({
      data: configs.map((config: AdminBranchPaymentConfigRecord) => mapAdminBranchPaymentConfig(config)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load branch payment configs';
    const status = message === 'Branch access denied' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.post('/payment-configs', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const payload = createBranchPaymentConfigSchema.parse(await c.req.json());
    ensureBranchAccess(admin, payload.branchId);

    const branch = await prisma.branch.findUnique({
      where: { id: payload.branchId },
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        isActive: true,
      },
    });

    if (!branch) {
      return c.json({ message: 'Branch not found' }, 404);
    }

    const created = await prisma.$transaction(async (tx) => {
      const config = await (tx as any).branchPaymentConfig.create({
        data: {
          branchId: payload.branchId,
          mode: payload.mode,
          provider: payload.provider,
          isActive: payload.isActive ?? true,
          approvalStatus: admin.role === 'hq_admin' ? 'approved' : 'pending_review',
          approvedAt: admin.role === 'hq_admin' ? new Date() : null,
          approvedByAdminId: admin.role === 'hq_admin' ? admin.id : null,
          displayName: payload.displayName,
          statementName: payload.statementName ?? null,
          settlementOwnerType: payload.settlementOwnerType ?? 'franchisee',
        },
      });

      for (const credential of payload.credentials) {
        const isSecret = credential.isSecret ?? true;
        await (tx as any).branchPaymentCredential.create({
          data: {
            branchPaymentConfigId: config.id,
            key: credential.key,
            valueEncrypted: encryptBranchPaymentCredential(credential.value),
            maskedValue: maskCredentialValue(credential.value, isSecret),
            isSecret,
          },
        });
      }

      await (tx as any).branchPaymentCapability.create({
        data: {
          branchPaymentConfigId: config.id,
          supportsWebhook: payload.capabilities?.supportsWebhook ?? false,
          supportsPolling: payload.capabilities?.supportsPolling ?? false,
          supportsDynamicQr: payload.capabilities?.supportsDynamicQr ?? false,
          supportsReferenceBinding: payload.capabilities?.supportsReferenceBinding ?? false,
          supportsRefund: payload.capabilities?.supportsRefund ?? false,
          supportsSliplessConfirmation: payload.capabilities?.supportsSliplessConfirmation ?? false,
        },
      });

      return (tx as any).branchPaymentConfig.findUniqueOrThrow({
        where: { id: config.id },
        include: {
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
              shortName: true,
              isActive: true,
            },
          },
          credentials: {
            orderBy: { key: 'asc' },
          },
          capabilities: true,
        },
      });
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.payment_config.create',
      entityType: 'branch_payment_config',
      entityId: created.id,
      branchId: payload.branchId,
      metadata: {
        mode: payload.mode,
        provider: payload.provider,
        approvalStatus: admin.role === 'hq_admin' ? 'approved' : 'pending_review',
        credentialKeys: payload.credentials.map((credential) => credential.key),
      },
    });

    return c.json({ data: mapAdminBranchPaymentConfig(created) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create branch payment config';
    const status =
      message === 'Branch access denied'
        ? 403
        : message === 'Branch not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/payment-configs/:id', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const configId = c.req.param('id');
    const payload = updateBranchPaymentConfigSchema.parse(await c.req.json());

    const existing = await (prisma as any).branchPaymentConfig.findUnique({
      where: { id: configId },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        credentials: true,
        capabilities: true,
      },
    });

    if (!existing) {
      return c.json({ message: 'Branch payment config not found' }, 404);
    }

    ensureBranchAccess(admin, existing.branchId);
    ensurePaymentConfigEditable(admin, existing);

    const updated = await prisma.$transaction(async (tx) => {
      await (tx as any).branchPaymentConfig.update({
        where: { id: configId },
        data: {
          mode: payload.mode,
          provider: payload.provider,
          isActive: payload.isActive,
          approvalStatus: admin.role === 'hq_admin' ? existing.approvalStatus : 'pending_review',
          approvedAt:
            admin.role === 'hq_admin'
              ? existing.approvedAt
              : null,
          approvedByAdminId:
            admin.role === 'hq_admin'
              ? existing.approvedByAdminId
              : null,
          displayName: payload.displayName,
          statementName: payload.statementName,
          settlementOwnerType: payload.settlementOwnerType,
        },
      });

      if (payload.credentials) {
        for (const credential of payload.credentials) {
          const isSecret = credential.isSecret ?? true;
          await (tx as any).branchPaymentCredential.upsert({
            where: {
              branchPaymentConfigId_key: {
                branchPaymentConfigId: configId,
                key: credential.key,
              },
            },
            update: {
              valueEncrypted: encryptBranchPaymentCredential(credential.value),
              maskedValue: maskCredentialValue(credential.value, isSecret),
              isSecret,
            },
            create: {
              branchPaymentConfigId: configId,
              key: credential.key,
              valueEncrypted: encryptBranchPaymentCredential(credential.value),
              maskedValue: maskCredentialValue(credential.value, isSecret),
              isSecret,
            },
          });
        }
      }

      if (payload.capabilities) {
        await (tx as any).branchPaymentCapability.upsert({
          where: { branchPaymentConfigId: configId },
          update: payload.capabilities,
          create: {
            branchPaymentConfigId: configId,
            supportsWebhook: payload.capabilities.supportsWebhook ?? false,
            supportsPolling: payload.capabilities.supportsPolling ?? false,
            supportsDynamicQr: payload.capabilities.supportsDynamicQr ?? false,
            supportsReferenceBinding: payload.capabilities.supportsReferenceBinding ?? false,
            supportsRefund: payload.capabilities.supportsRefund ?? false,
            supportsSliplessConfirmation: payload.capabilities.supportsSliplessConfirmation ?? false,
          },
        });
      }

      return (tx as any).branchPaymentConfig.findUniqueOrThrow({
        where: { id: configId },
        include: {
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
              shortName: true,
              isActive: true,
            },
          },
          credentials: {
            orderBy: { key: 'asc' },
          },
          capabilities: true,
        },
      });
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.payment_config.update',
      entityType: 'branch_payment_config',
      entityId: updated.id,
      branchId: updated.branchId,
      metadata: {
        updatedFields: Object.keys(payload),
        approvalStatus: admin.role === 'hq_admin' ? existing.approvalStatus : 'pending_review',
        credentialKeys: payload.credentials?.map((credential) => credential.key) ?? [],
      },
    });

    return c.json({ data: mapAdminBranchPaymentConfig(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update branch payment config';
    const status =
      message === 'Branch access denied'
        ? 403
        : message === 'This payment config is locked by HQ'
          ? 409
        : message === 'Branch payment config not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/payment-configs/:id/activation', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    const configId = c.req.param('id');
    const payload = branchPaymentActivationSchema.parse(await c.req.json());

    const existing = await (prisma as any).branchPaymentConfig.findUnique({
      where: { id: configId },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        credentials: true,
        capabilities: true,
      },
    });

    if (!existing) {
      return c.json({ message: 'Branch payment config not found' }, 404);
    }

    ensureBranchAccess(admin, existing.branchId);
    ensurePaymentConfigEditable(admin, existing);

    const updated = await (prisma as any).branchPaymentConfig.update({
      where: { id: configId },
      data: {
        isActive: payload.isActive,
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        credentials: {
          orderBy: { key: 'asc' },
        },
        capabilities: true,
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: payload.isActive ? 'admin.payment_config.activate' : 'admin.payment_config.deactivate',
      entityType: 'branch_payment_config',
      entityId: updated.id,
      branchId: updated.branchId,
    });

    return c.json({ data: mapAdminBranchPaymentConfig(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update branch payment config activation';
    const status =
      message === 'Branch access denied'
        ? 403
        : message === 'This payment config is locked by HQ'
          ? 409
        : message === 'Branch payment config not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/payment-configs/governance-overview', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    ensureHqRole(admin);

    const configs = await (prisma as any).branchPaymentConfig.findMany({
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        credentials: {
          orderBy: { key: 'asc' },
        },
        capabilities: true,
      },
      orderBy: [{ branchId: 'asc' }, { isActive: 'desc' }, { updatedAt: 'desc' }],
    });

    const overview: Array<ReturnType<typeof mapPaymentConfigGovernanceOverview>> = configs.map(
      (config: AdminBranchPaymentConfigRecord) => mapPaymentConfigGovernanceOverview(config)
    );

    return c.json({
      data: {
        items: overview,
        summary: {
          total: overview.length,
          approved: overview.filter((item) => item.config.approvalStatus === 'approved').length,
          pendingReview: overview.filter((item) => item.config.approvalStatus === 'pending_review').length,
          locked: overview.filter((item) => item.config.isLocked).length,
          ready: overview.filter((item) => item.readiness.ready).length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payment governance overview';
    const status = message === 'Only HQ can manage global packages' ? 403 : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.patch('/payment-configs/:id/governance', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    ensureHqRole(admin);

    const configId = c.req.param('id');
    const payload = paymentConfigGovernanceSchema.parse(await c.req.json());

    const existing = await (prisma as any).branchPaymentConfig.findUnique({
      where: { id: configId },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        credentials: {
          orderBy: { key: 'asc' },
        },
        capabilities: true,
      },
    });

    if (!existing) {
      return c.json({ message: 'Branch payment config not found' }, 404);
    }

    const approvalStatus = payload.approvalStatus ?? existing.approvalStatus;
    const updated = await (prisma as any).branchPaymentConfig.update({
      where: { id: configId },
      data: {
        isLocked: payload.isLocked,
        approvalStatus,
        approvedAt: approvalStatus === 'approved' ? new Date() : null,
        approvedByAdminId: approvalStatus === 'approved' ? admin.id : null,
      },
      include: {
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            isActive: true,
          },
        },
        credentials: {
          orderBy: { key: 'asc' },
        },
        capabilities: true,
      },
    });

    await logAdminAction({
      adminUserId: admin.id,
      action: 'admin.payment_config.governance_update',
      entityType: 'branch_payment_config',
      entityId: updated.id,
      branchId: updated.branchId,
      metadata: {
        isLocked: updated.isLocked,
        approvalStatus: updated.approvalStatus,
      },
    });

    return c.json({ data: mapAdminBranchPaymentConfig(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update payment governance';
    const status =
      message === 'Only HQ can manage global packages'
        ? 403
        : message === 'Branch payment config not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/payment-configs/:id/audit', requireAdmin, async (c) => {
  const admin = await resolveAdmin(c);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    ensureHqRole(admin);

    const configId = c.req.param('id');
    const config = await (prisma as any).branchPaymentConfig.findUnique({
      where: { id: configId },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!config) {
      return c.json({ message: 'Branch payment config not found' }, 404);
    }

    const entries = await prisma.auditLog.findMany({
      where: {
        entityType: 'branch_payment_config',
        entityId: configId,
      },
      include: {
        adminUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return c.json({
      data: {
        configId,
        branchId: config.branchId,
        entries: entries.map((entry) => mapAuditLogRecord(entry)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payment audit log';
    const status =
      message === 'Only HQ can manage global packages'
        ? 403
        : message === 'Branch payment config not found'
          ? 404
          : 400;
    return c.json({ message }, status);
  }
});

adminRoutes.get('/policies/branch-settings', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  if (role !== 'hq_admin') {
    return c.json({ message: 'Only HQ can manage global policies' }, 403);
  }

  const branches = await prisma.branch.findMany({
    orderBy: { name: 'asc' },
    include: {
      settings: true,
    },
  });

  return c.json({
    data: {
      branches: branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        shortName: branch.shortName,
        isActive: branch.isActive,
        settings: mapBranchSettings(branch.settings),
      })),
      editableFields: Object.keys(branchSettingsSchema.shape),
    },
  });
});

adminRoutes.patch('/policies/branch-settings', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');
  if (role !== 'hq_admin') {
    return c.json({ message: 'Only HQ can manage global policies' }, 403);
  }

  const body = await c.req.json();
  const payload = z
    .object({
      branchIds: z.array(z.string()).optional(),
      settings: branchSettingsSchema.refine(
        (value) => Object.keys(value).length > 0,
        'At least one settings field is required'
      ),
    })
    .parse(body);

  const targetBranches =
    payload.branchIds && payload.branchIds.length > 0
      ? payload.branchIds
      : (
          await prisma.branch.findMany({
            select: { id: true },
          })
        ).map((branch) => branch.id);

  await prisma.$transaction(
    targetBranches.map((branchId) =>
      prisma.branchSettings.upsert({
        where: { branchId },
        update: payload.settings,
        create: {
          branchId,
          ...payload.settings,
        },
      })
    )
  );

  await logAdminAction({
    adminUserId: adminId,
    action: 'admin.policy.apply_branch_settings',
    entityType: 'branch_settings',
    metadata: {
      branchIds: targetBranches,
      settings: payload.settings,
    } as unknown as Prisma.InputJsonValue,
  });

  return c.json({
    data: {
      updatedCount: targetBranches.length,
      branchIds: targetBranches,
      settings: payload.settings,
    },
  });
});

adminRoutes.get('/users', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  if (role !== 'hq_admin') {
    return c.json({ message: 'Only HQ can view admin users' }, 403);
  }

  const admins = await prisma.adminUser.findMany({
    include: {
      branchScopes: {
        include: {
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  return c.json({
    data: admins.map((adminUser) => mapAdminIdentity(adminUser)),
  });
});

adminRoutes.post('/users', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');
  if (role !== 'hq_admin') {
    return c.json({ message: 'Only HQ can create admin users' }, 403);
  }

  const body = await c.req.json();
  const data = createAdminUserSchema.parse(body);
  const branchScopes = normalizeBranchScopes(data);

  const passwordHash = await bcrypt.hash(data.password, 12);

  const createdAdmin = await prisma.adminUser.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role,
      branchScopes:
        branchScopes.length > 0
          ? {
              create: branchScopes,
            }
          : undefined,
    },
    include: {
      branchScopes: {
        include: {
          branch: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  });

  await logAdminAction({
    adminUserId: adminId,
    action: 'admin.user.create',
    entityType: 'admin_user',
    entityId: createdAdmin.id,
    metadata: {
      role: createdAdmin.role,
      branchScopeCount: branchScopes.length,
    },
  });

  return c.json(
    {
      data: mapAdminIdentity(createdAdmin),
    },
    201
  );
});

adminRoutes.patch('/users/:id', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const actorAdminId = c.get('adminId');
  if (role !== 'hq_admin') {
    return c.json({ message: 'Only HQ can update admin users' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const data = updateAdminUserSchema.parse(body);

  if (actorAdminId === id && (data.isActive === false || data.role === 'branch_admin')) {
    return c.json({ message: 'You cannot deactivate or demote your own HQ account' }, 400);
  }

  const existing = await prisma.adminUser.findUnique({
    where: { id },
    include: {
      branchScopes: true,
    },
  });

  if (!existing) {
    return c.json({ message: 'Admin user not found' }, 404);
  }

  const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : undefined;
  const nextRole = data.role ?? existing.role;
  const nextScopes = data.branchScopes
    ? normalizeBranchScopes({
        role: nextRole,
        branchScopes: data.branchScopes,
      })
    : null;

  const updated = await prisma.$transaction(async (tx) => {
    const adminUser = await tx.adminUser.update({
      where: { id },
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        isActive: data.isActive,
        passwordHash,
      },
    });

    if (nextScopes) {
      await tx.adminBranchScope.deleteMany({
        where: { adminUserId: id },
      });

      if (nextScopes.length > 0) {
        await tx.adminBranchScope.createMany({
          data: nextScopes.map((scope) => ({
            adminUserId: id,
            branchId: scope.branchId,
            canViewRevenue: scope.canViewRevenue,
            canManageMachines: scope.canManageMachines,
            canManageCoupons: scope.canManageCoupons,
          })),
        });
      }
    }

    return tx.adminUser.findUniqueOrThrow({
      where: { id: adminUser.id },
      include: {
        branchScopes: {
          include: {
            branch: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });
  });

  await logAdminAction({
    adminUserId: actorAdminId,
    action: 'admin.user.update',
    entityType: 'admin_user',
    entityId: id,
    metadata: {
      updatedFields: Object.keys(data).filter((key) => key !== 'password'),
    },
  });

  return c.json({
    data: mapAdminIdentity(updated),
  });
});
