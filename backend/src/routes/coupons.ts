import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/types.js';

export const couponRoutes = new Hono<AppEnv>();
couponRoutes.use('*', requireAuth);

const couponPurchaseCreateSchema = z
  .object({
    branchId: z.string().min(1),
    customerNote: z.string().trim().max(300).optional(),
  })
  .strict();

const activePurchaseStatuses = ['pending_transfer', 'pending_review', 'confirmed'] as const;

const couponPurchaseInclude = {
  paymentAccount: {
    select: {
      id: true,
      code: true,
      displayName: true,
      accountType: true,
      promptPayId: true,
      promptPayName: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
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
  coupon: {
    include: {
      branches: {
        select: { branchId: true },
      },
    },
  },
} as const;

function buildCouponPurchaseReference() {
  const dateKey = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CP-${dateKey}-${suffix}`;
}

async function buildUniqueCouponPurchaseReference() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = buildCouponPurchaseReference();
    const existing = await prisma.couponPurchase.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (!existing) {
      return reference;
    }
  }

  return `CP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function mapCouponRecord(coupon: any) {
  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    description: coupon.description,
    scope: coupon.scope,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minSpend: coupon.minSpend,
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    isPurchasable: coupon.isPurchasable,
    purchasePrice: coupon.purchasePrice,
    branchIds: coupon.branches?.map((branch: any) => branch.branchId) ?? [],
    packageIds: coupon.packageIds,
    validFrom: coupon.validFrom.toISOString(),
    validUntil: coupon.validUntil.toISOString(),
  };
}

function mapCouponPurchase(purchase: any) {
  return {
    id: purchase.id,
    userId: purchase.userId,
    couponId: purchase.couponId,
    branchId: purchase.branchId,
    paymentAccountId: purchase.paymentAccountId,
    issuedUserCouponId: purchase.issuedUserCouponId,
    status: purchase.status,
    amount: purchase.amount,
    currency: purchase.currency,
    paymentMethod: purchase.paymentMethod,
    reference: purchase.reference,
    transferTargetId: purchase.transferTargetId,
    transferTargetName: purchase.transferTargetName,
    slipImageHash: purchase.slipImageHash ? purchase.slipImageHash.slice(0, 12) : null,
    slipUploadedAt: purchase.slipUploadedAt?.toISOString() ?? null,
    customerNote: purchase.customerNote,
    adminNote: purchase.adminNote,
    confirmedAt: purchase.confirmedAt?.toISOString() ?? null,
    rejectedAt: purchase.rejectedAt?.toISOString() ?? null,
    expiresAt: purchase.expiresAt?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    branch: purchase.branch
      ? {
          id: purchase.branch.id,
          code: purchase.branch.code,
          name: purchase.branch.name,
          shortName: purchase.branch.shortName,
          promptPayId: purchase.branch.promptPayId,
          promptPayName: purchase.branch.promptPayName,
        }
      : null,
    paymentAccount: purchase.paymentAccount
      ? {
          id: purchase.paymentAccount.id,
          code: purchase.paymentAccount.code,
          displayName: purchase.paymentAccount.displayName,
          accountType: purchase.paymentAccount.accountType,
          promptPayId: purchase.paymentAccount.promptPayId,
          promptPayName: purchase.paymentAccount.promptPayName,
          bankName: purchase.paymentAccount.bankName,
          accountName: purchase.paymentAccount.accountName,
          accountNumber: purchase.paymentAccount.accountNumber,
        }
      : null,
    coupon: purchase.coupon ? mapCouponRecord(purchase.coupon) : null,
  };
}

async function resolveCouponPaymentTarget(branch: {
  id: string;
  code: string;
  promptPayId: string;
  promptPayName: string;
}) {
  const branchAccount = await prisma.couponPaymentAccount.findFirst({
    where: {
      accountType: 'branch',
      branchId: branch.id,
      isActive: true,
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });

  if (branchAccount) {
    return {
      account: branchAccount,
      transferTargetId: branchAccount.promptPayId,
      transferTargetName: branchAccount.promptPayName,
      source: 'coupon_branch_account',
    };
  }

  const hqAccount = await prisma.couponPaymentAccount.findFirst({
    where: {
      accountType: 'hq',
      isActive: true,
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });

  if (hqAccount) {
    return {
      account: hqAccount,
      transferTargetId: hqAccount.promptPayId,
      transferTargetName: hqAccount.promptPayName,
      source: 'coupon_hq_account',
    };
  }

  return {
    account: null,
    transferTargetId: branch.promptPayId,
    transferTargetName: branch.promptPayName,
    source: 'branch_promptpay_fallback',
  };
}

function ensureCouponCanBeIssued(coupon: any) {
  const now = new Date();
  if (coupon.status !== 'active') {
    throw new Error('Coupon is not active');
  }

  if (now < coupon.validFrom || now > coupon.validUntil) {
    throw new Error('Coupon is not valid at this time');
  }

  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    throw new Error('Coupon usage limit reached');
  }
}

couponRoutes.get('/available', async (c) => {
  const userId = c.get('userId');
  const branchId = c.req.query('branchId');
  const now = new Date();

  const [coupons, claimedCoupons] = await Promise.all([
    prisma.coupon.findMany({
      where: {
        status: 'active',
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      include: {
        branches: {
          select: { branchId: true },
        },
      },
      orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.userCoupon.findMany({
      where: { userId },
      select: { couponId: true },
    }),
  ]);

  const claimedCouponIds = new Set(claimedCoupons.map((item) => item.couponId));

  const filtered = coupons.filter((coupon) => {
    if (claimedCouponIds.has(coupon.id)) {
      return false;
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return false;
    }

    if (!branchId) {
      return true;
    }

    const branchIds = coupon.branches.map((branch) => branch.branchId);
    return coupon.scope === 'all_branches' || branchIds.includes(branchId);
  });

  return c.json({
    data: filtered.map(mapCouponRecord),
  });
});

couponRoutes.get('/purchases', async (c) => {
  const userId = c.get('userId');

  const purchases = await prisma.couponPurchase.findMany({
    where: { userId },
    include: couponPurchaseInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return c.json({ data: purchases.map(mapCouponPurchase) });
});

couponRoutes.post('/:id/purchase', async (c) => {
  const userId = c.get('userId');
  const couponId = c.req.param('id');
  const payload = couponPurchaseCreateSchema.parse(await c.req.json());

  try {
    const coupon = await prisma.coupon.findUnique({
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
                promptPayId: true,
                promptPayName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      return c.json({ message: 'Coupon not found' }, 404);
    }

    ensureCouponCanBeIssued(coupon);

    if (!coupon.isPurchasable || coupon.purchasePrice <= 0) {
      return c.json({ message: 'Coupon is free. Please claim it instead.' }, 400);
    }

    const branch = await prisma.branch.findUnique({
      where: { id: payload.branchId },
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        promptPayId: true,
        promptPayName: true,
        isActive: true,
      },
    });

    if (!branch || !branch.isActive) {
      return c.json({ message: 'Branch is not available for coupon transfer' }, 400);
    }

    const couponBranchIds = coupon.branches.map((item) => item.branchId);
    if (coupon.scope !== 'all_branches' && !couponBranchIds.includes(branch.id)) {
      return c.json({ message: 'Coupon is not valid for this branch' }, 400);
    }

    const existingCoupon = await prisma.userCoupon.findUnique({
      where: { userId_couponId: { userId, couponId: coupon.id } },
      select: { id: true },
    });

    if (existingCoupon) {
      return c.json({ message: 'Coupon already claimed' }, 400);
    }

    const existingPurchase = await prisma.couponPurchase.findFirst({
      where: {
        userId,
        couponId: coupon.id,
        status: { in: [...activePurchaseStatuses] },
      },
      include: couponPurchaseInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (existingPurchase) {
      return c.json({ data: mapCouponPurchase(existingPurchase) });
    }

    const reference = await buildUniqueCouponPurchaseReference();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const paymentTarget = await resolveCouponPaymentTarget(branch);

    const purchase = await prisma.couponPurchase.create({
      data: {
        userId,
        couponId: coupon.id,
        branchId: branch.id,
        paymentAccountId: paymentTarget.account?.id ?? null,
        amount: coupon.purchasePrice,
        reference,
        transferTargetId: paymentTarget.transferTargetId,
        transferTargetName: paymentTarget.transferTargetName,
        customerNote: payload.customerNote?.trim() || null,
        expiresAt,
        metadata: {
          couponCode: coupon.code,
          couponTitle: coupon.title,
          branchCode: branch.code,
          paymentTargetSource: paymentTarget.source,
          paymentAccountId: paymentTarget.account?.id ?? null,
          issuedBy: 'customer_coupon_purchase',
        },
      },
      include: couponPurchaseInclude,
    });

    return c.json({ data: mapCouponPurchase(purchase) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create coupon purchase';
    const status =
      message === 'Coupon is not active' ||
      message === 'Coupon is not valid at this time' ||
      message === 'Coupon usage limit reached'
        ? 400
        : 500;
    return c.json({ message }, status);
  }
});

couponRoutes.post('/purchases/:id/slip', async (c) => {
  const userId = c.get('userId');
  const purchaseId = c.req.param('id');

  try {
    const formData = await c.req.raw.formData();
    const uploadedFile = formData.get('file');
    const customerNote = formData.get('customerNote');

    if (!(uploadedFile instanceof File)) {
      return c.json({ message: 'Slip image is required' }, 400);
    }

    const purchase = await prisma.couponPurchase.findFirst({
      where: { id: purchaseId, userId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!purchase) {
      return c.json({ message: 'Coupon purchase not found' }, 404);
    }

    if (!['pending_transfer', 'pending_review'].includes(purchase.status)) {
      return c.json({ message: `Coupon purchase is ${purchase.status} and cannot receive a slip` }, 400);
    }

    if (purchase.expiresAt && purchase.expiresAt.getTime() < Date.now()) {
      await prisma.couponPurchase.update({
        where: { id: purchase.id },
        data: { status: 'expired' },
      });
      return c.json({ message: 'Coupon purchase has expired' }, 400);
    }

    const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
    if (bytes.byteLength > 1_500_000) {
      return c.json({ message: 'Slip image is too large' }, 400);
    }

    const mimeType = uploadedFile.type || 'application/octet-stream';
    const slipImageHash = createHash('sha256').update(bytes).digest('hex');
    const duplicatedSlip = await prisma.couponPurchase.findFirst({
      where: {
        slipImageHash,
        id: { not: purchase.id },
        status: { notIn: ['cancelled'] },
      },
      select: {
        id: true,
        reference: true,
        status: true,
      },
    });

    if (duplicatedSlip) {
      return c.json(
        {
          message: `This slip was already uploaded for reference ${duplicatedSlip.reference}`,
        },
        400
      );
    }

    const slipImage = `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;

    const updated = await prisma.couponPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'pending_review',
        slipImage,
        slipImageHash,
        slipFileName: uploadedFile.name || 'slip.jpg',
        slipMimeType: mimeType,
        slipUploadedAt: new Date(),
        customerNote:
          typeof customerNote === 'string' && customerNote.trim().length > 0
            ? customerNote.trim().slice(0, 300)
            : undefined,
      },
      include: couponPurchaseInclude,
    });

    return c.json({ data: mapCouponPurchase(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload coupon purchase slip';
    return c.json({ message }, 400);
  }
});

// Get user's coupons (optional ?branchId= filter)
couponRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const branchId = c.req.query('branchId');

  const userCoupons = await prisma.userCoupon.findMany({
    where: { userId },
    include: {
      coupon: {
        include: {
          branches: {
            select: { branchId: true },
          },
        },
      },
    },
    orderBy: { coupon: { validUntil: 'desc' } },
  });

  let filtered = userCoupons;
  if (branchId) {
    filtered = userCoupons.filter((uc) => {
      const ids = uc.coupon.branches.map((branch) => branch.branchId);
      return uc.coupon.scope === 'all_branches' || ids.includes(branchId);
    });
  }

  return c.json({
    data: filtered.map((uc) => ({
      id: uc.id,
      userId: uc.userId,
      couponId: uc.couponId,
      isUsed: uc.status === 'redeemed',
      usedAt: uc.redeemedAt?.toISOString() || null,
      status: uc.status,
      coupon: {
        id: uc.coupon.id,
        code: uc.coupon.code,
        title: uc.coupon.title,
        description: uc.coupon.description,
        scope: uc.coupon.scope,
        discountType: uc.coupon.discountType,
        discountValue: uc.coupon.discountValue,
        minSpend: uc.coupon.minSpend,
        isPurchasable: uc.coupon.isPurchasable,
        purchasePrice: uc.coupon.purchasePrice,
        branchIds: uc.coupon.branches.map((branch) => branch.branchId),
        packageIds: uc.coupon.packageIds,
        validFrom: uc.coupon.validFrom.toISOString(),
        validUntil: uc.coupon.validUntil.toISOString(),
      },
    })),
  });
});

// Claim a coupon by code
couponRoutes.post('/claim', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { code } = z.object({ code: z.string().min(1) }).parse(body);

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: {
      branches: {
        select: { branchId: true },
      },
    },
  });

  if (!coupon) {
    return c.json({ message: 'Invalid coupon code' }, 404);
  }

  if (coupon.status !== 'active') {
    return c.json({ message: 'Coupon is not active' }, 400);
  }

  if (new Date() < coupon.validFrom || new Date() > coupon.validUntil) {
    return c.json({ message: 'Coupon is not valid at this time' }, 400);
  }

  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return c.json({ message: 'Coupon usage limit reached' }, 400);
  }

  if (coupon.isPurchasable && coupon.purchasePrice > 0) {
    return c.json({ message: 'Coupon requires bank transfer purchase' }, 400);
  }

  const existing = await prisma.userCoupon.findUnique({
    where: { userId_couponId: { userId, couponId: coupon.id } },
  });

  if (existing) {
    return c.json({ message: 'Coupon already claimed' }, 400);
  }

  const userCoupon = await prisma.userCoupon.create({
    data: { userId, couponId: coupon.id },
    include: { coupon: true },
  });

  return c.json({ data: userCoupon }, 201);
});

// Use a coupon
couponRoutes.post('/:id/use', async (c) => {
  const userId = c.get('userId');
  const couponId = c.req.param('id');
  const body = await c.req.json();
  const { sessionId } = z.object({ sessionId: z.string() }).parse(body);

  const userCoupon = await prisma.userCoupon.findFirst({
    where: { id: couponId, userId, status: 'claimed' },
    include: {
      coupon: {
        include: {
          branches: {
            select: { branchId: true },
          },
        },
      },
    },
  });

  if (!userCoupon) {
    return c.json({ message: 'Coupon not found or already used' }, 400);
  }

  const session = await prisma.washSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    return c.json({ message: 'Session not found' }, 404);
  }

  const allowedBranchIds = userCoupon.coupon.branches.map((branch) => branch.branchId);
  const isAllowedBranch =
    userCoupon.coupon.scope === 'all_branches' || allowedBranchIds.includes(session.branchId);

  if (!isAllowedBranch) {
    return c.json({ message: 'Coupon is not valid for this branch' }, 400);
  }

  const discountAmount =
    userCoupon.coupon.discountType === 'percent'
      ? Math.floor((session.subtotalPrice || session.totalPrice) * (userCoupon.coupon.discountValue / 100))
      : userCoupon.coupon.discountValue;

  const [updated] = await prisma.$transaction([
    prisma.userCoupon.update({
      where: { id: userCoupon.id },
      data: { status: 'redeemed', redeemedAt: new Date() },
      include: { coupon: true },
    }),
    prisma.couponRedemption.create({
      data: {
        userCouponId: userCoupon.id,
        couponId: userCoupon.couponId,
        userId,
        branchId: session.branchId,
        sessionId: session.id,
        discountAmount,
      },
    }),
    prisma.coupon.update({
      where: { id: userCoupon.couponId },
      data: { usedCount: { increment: 1 } },
    }),
    prisma.washSession.update({
      where: { id: session.id },
      data: {
        discountAmount,
        totalPrice: Math.max(session.totalPrice - discountAmount, 0),
      },
    }),
  ]);

  return c.json({ data: updated });
});
