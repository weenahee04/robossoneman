import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';

type PaymentConfigWithRelations = {
  id: string;
  branchId: string;
  mode: string;
  provider: string;
  isActive: boolean;
  isLocked?: boolean;
  approvalStatus?: string;
  approvedAt?: Date | null;
  approvedByAdminId?: string | null;
  displayName: string;
  statementName: string | null;
  settlementOwnerType: string;
  createdAt: Date;
  updatedAt: Date;
  credentials: Array<{
    id: string;
    key: string;
    valueEncrypted?: string;
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

function getCredentialSecret() {
  const secret =
    process.env.BRANCH_PAYMENT_CREDENTIAL_SECRET?.trim() ||
    process.env.SCAN_TOKEN_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('BRANCH_PAYMENT_CREDENTIAL_SECRET, SCAN_TOKEN_SECRET, or JWT_SECRET is required');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function toBase64Url(value: Buffer) {
  return value.toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}

export function encryptBranchPaymentCredential(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCredentialSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${toBase64Url(iv)}.${toBase64Url(authTag)}.${toBase64Url(encrypted)}`;
}

export function decryptBranchPaymentCredential(valueEncrypted: string) {
  const [ivPart, authTagPart, encryptedPart] = valueEncrypted.split('.');
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('Encrypted branch payment credential format is invalid');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getCredentialSecret(),
    fromBase64Url(ivPart)
  );
  decipher.setAuthTag(fromBase64Url(authTagPart));

  const decrypted = Buffer.concat([
    decipher.update(fromBase64Url(encryptedPart)),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function maskCredentialValue(value: string, isSecret = true) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (!isSecret) {
    return trimmed;
  }

  if (trimmed.length <= 4) {
    return '*'.repeat(trimmed.length);
  }

  return `${trimmed.slice(0, 2)}${'*'.repeat(Math.max(trimmed.length - 4, 2))}${trimmed.slice(-2)}`;
}

export function buildBranchPaymentConfigSummary(config: PaymentConfigWithRelations) {
  return {
    id: config.id,
    branchId: config.branchId,
    mode: config.mode,
    provider: config.provider,
    isActive: config.isActive,
    isLocked: config.isLocked ?? false,
    approvalStatus: config.approvalStatus ?? 'draft',
    approvedAt: config.approvedAt ?? null,
    approvedByAdminId: config.approvedByAdminId ?? null,
    displayName: config.displayName,
    statementName: config.statementName,
    settlementOwnerType: config.settlementOwnerType,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    credentials: config.credentials.map((credential) => ({
      id: credential.id,
      key: credential.key,
      maskedValue: credential.maskedValue,
      isSecret: credential.isSecret,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    })),
    capabilities: config.capabilities
      ? {
          supportsWebhook: config.capabilities.supportsWebhook,
          supportsPolling: config.capabilities.supportsPolling,
          supportsDynamicQr: config.capabilities.supportsDynamicQr,
          supportsReferenceBinding: config.capabilities.supportsReferenceBinding,
          supportsRefund: config.capabilities.supportsRefund,
          supportsSliplessConfirmation: config.capabilities.supportsSliplessConfirmation,
        }
      : null,
  };
}

export async function getBranchPaymentConfigById(id: string) {
  return (prisma as any).branchPaymentConfig.findUnique({
    where: { id },
    include: {
      credentials: {
        orderBy: { key: 'asc' },
      },
      capabilities: true,
    },
  });
}

export async function getBranchPaymentConfigs(branchId: string) {
  return (prisma as any).branchPaymentConfig.findMany({
    where: { branchId },
    include: {
      credentials: {
        orderBy: { key: 'asc' },
      },
      capabilities: true,
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function resolveActiveBranchPaymentConfig(branchId: string) {
  return (prisma as any).branchPaymentConfig.findFirst({
    where: {
      branchId,
      isActive: true,
    },
    include: {
      credentials: true,
      capabilities: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export function getBranchPaymentCredentialMap(
  config: {
    credentials?: Array<{
      key: string;
      valueEncrypted?: string;
      maskedValue?: string | null;
    }>;
  } | null | undefined
) {
  const entries = (config?.credentials ?? [])
    .filter((credential) => credential.valueEncrypted)
    .map((credential) => [credential.key, decryptBranchPaymentCredential(credential.valueEncrypted!)]);

  return Object.fromEntries(entries) as Record<string, string>;
}

export function resolveBranchPaymentAdapterName(provider: string) {
  switch (provider) {
    case 'promptpay_manual':
      return 'mock_promptpay';
    case 'stripe':
      return 'stripe';
    case 'ksher':
      return 'ksher';
    case 'custom':
      return process.env.PAYMENT_PROVIDER_NAME || 'generic_rest';
    default:
      return 'generic_rest';
  }
}

export function resolveBranchPaymentTarget(config: {
  provider: string;
  displayName: string;
  statementName?: string | null;
  credentials?: Array<{
    key: string;
    valueEncrypted?: string;
  }>;
}) {
  const credentials = getBranchPaymentCredentialMap(config);
  const promptPayId = credentials.promptpay_id;
  const promptPayName = credentials.promptpay_name ?? config.statementName ?? config.displayName;

  if (!promptPayId) {
    throw new Error('Active branch payment config is missing promptpay_id');
  }

  return {
    adapterName: resolveBranchPaymentAdapterName(config.provider),
    paymentQrType: config.provider === 'promptpay_manual' ? 'promptpay_manual' : 'provider_dynamic',
    promptPayId,
    promptPayName,
    credentialKeys: Object.keys(credentials),
  };
}

export async function upsertBranchPaymentConfig(params: {
  branchId: string;
  mode: string;
  provider: string;
  isActive?: boolean;
  displayName: string;
  statementName?: string | null;
  settlementOwnerType?: string;
  credentials?: Array<{
    key: string;
    value: string;
    isSecret?: boolean;
  }>;
  capabilities?: Partial<{
    supportsWebhook: boolean;
    supportsPolling: boolean;
    supportsDynamicQr: boolean;
    supportsReferenceBinding: boolean;
    supportsRefund: boolean;
    supportsSliplessConfirmation: boolean;
  }>;
}) {
  return prisma.$transaction(async (tx) => {
    const config = await (tx as any).branchPaymentConfig.create({
      data: {
        branchId: params.branchId,
        mode: params.mode,
        provider: params.provider,
        isActive: params.isActive ?? true,
        approvalStatus: 'draft',
        displayName: params.displayName,
        statementName: params.statementName ?? null,
        settlementOwnerType: params.settlementOwnerType ?? 'franchisee',
      },
    });

    if (params.credentials?.length) {
      for (const credential of params.credentials) {
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
    }

    await (tx as any).branchPaymentCapability.create({
      data: {
        branchPaymentConfigId: config.id,
        supportsWebhook: params.capabilities?.supportsWebhook ?? false,
        supportsPolling: params.capabilities?.supportsPolling ?? false,
        supportsDynamicQr: params.capabilities?.supportsDynamicQr ?? false,
        supportsReferenceBinding: params.capabilities?.supportsReferenceBinding ?? false,
        supportsRefund: params.capabilities?.supportsRefund ?? false,
        supportsSliplessConfirmation: params.capabilities?.supportsSliplessConfirmation ?? false,
      },
    });

    return (tx as any).branchPaymentConfig.findUniqueOrThrow({
      where: { id: config.id },
      include: {
        credentials: {
          orderBy: { key: 'asc' },
        },
        capabilities: true,
      },
    });
  });
}
