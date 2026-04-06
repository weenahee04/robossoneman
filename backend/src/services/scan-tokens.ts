import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { mapCustomerBranch, mapCustomerMachine, mapCustomerPackage } from '../lib/mappers.js';
import { prisma } from '../lib/prisma.js';

const DEFAULT_SCAN_TOKEN_TTL_SECONDS = 5 * 60;

const machineScanTokenPayloadSchema = z
  .object({
    v: z.literal(1),
    branchId: z.string().min(1),
    machineId: z.string().min(1),
    machineCode: z.string().min(1).optional(),
    issuedAt: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
    nonce: z.string().min(8),
    deviceHint: z.string().min(1).optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.expiresAt <= payload.issuedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expiresAt must be greater than issuedAt',
        path: ['expiresAt'],
      });
    }
  });

export type MachineScanTokenPayload = z.infer<typeof machineScanTokenPayloadSchema>;

export class ScanTokenError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code:
      | 'invalid_scan_token'
      | 'expired_scan_token'
      | 'consumed_scan_token'
      | 'machine_not_found'
  ) {
    super(message);
    this.name = 'ScanTokenError';
  }
}

function getScanTokenSecret() {
  const secret = process.env.SCAN_TOKEN_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('SCAN_TOKEN_SECRET or JWT_SECRET is required');
  }

  return secret;
}

export function getScanTokenTtlSeconds() {
  const raw = Number(process.env.SCAN_TOKEN_TTL_SECONDS ?? DEFAULT_SCAN_TOKEN_TTL_SECONDS);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_SCAN_TOKEN_TTL_SECONDS;
}

function encodePayload(payload: MachineScanTokenPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encodedPayload: string) {
  const decoded = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  return machineScanTokenPayloadSchema.parse(JSON.parse(decoded));
}

function signEncodedPayload(encodedPayload: string) {
  return crypto.createHmac('sha256', getScanTokenSecret()).update(encodedPayload).digest('base64url');
}

function assertMatchingSignature(encodedPayload: string, signature: string) {
  const expected = signEncodedPayload(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new ScanTokenError('Scan token signature is invalid', 400, 'invalid_scan_token');
  }
}

function assertNotExpired(expiresAt: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (expiresAt <= nowSeconds) {
    throw new ScanTokenError('Scan token has expired', 410, 'expired_scan_token');
  }
}

export function hashScanToken(token: string) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function createMachineScanToken(params: {
  branchId: string;
  machineId: string;
  machineCode?: string | null;
  deviceHint?: string | null;
  issuedAt?: number;
  expiresAt?: number;
  nonce?: string;
}) {
  const issuedAt = params.issuedAt ?? Math.floor(Date.now() / 1000);
  const expiresAt = params.expiresAt ?? (issuedAt + getScanTokenTtlSeconds());
  const payload = machineScanTokenPayloadSchema.parse({
    v: 1,
    branchId: params.branchId,
    machineId: params.machineId,
    machineCode: params.machineCode ?? undefined,
    issuedAt,
    expiresAt,
    nonce: params.nonce ?? crypto.randomBytes(12).toString('hex'),
    deviceHint: params.deviceHint ?? undefined,
  });

  const encodedPayload = encodePayload(payload);
  const signature = signEncodedPayload(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  };
}

export function verifyMachineScanToken(token: string) {
  const trimmedToken = token.trim();
  const [encodedPayload, signature, ...extra] = trimmedToken.split('.');

  if (!encodedPayload || !signature || extra.length > 0) {
    throw new ScanTokenError('Scan token format is invalid', 400, 'invalid_scan_token');
  }

  assertMatchingSignature(encodedPayload, signature);
  const payload = decodePayload(encodedPayload);
  assertNotExpired(payload.expiresAt);

  return {
    payload,
    tokenHash: hashScanToken(trimmedToken),
  };
}

export async function resolveBranchMachineFromScanToken(scanToken: string) {
  const { payload, tokenHash } = verifyMachineScanToken(scanToken);

  const machine = await prisma.machine.findFirst({
    where: {
      id: payload.machineId,
      branchId: payload.branchId,
      isEnabled: true,
      branch: { isActive: true },
    },
    include: {
      branch: {
        include: {
          settings: true,
          machines: {
            select: {
              id: true,
              branchId: true,
              code: true,
              name: true,
              type: true,
              status: true,
              espDeviceId: true,
              isEnabled: true,
              maintenanceNote: true,
              firmwareVersion: true,
              lastHeartbeat: true,
            },
          },
          packageConfigs: {
            where: { isActive: true, isVisible: true },
            include: { package: true },
          },
        },
      },
    },
  });

  if (!machine) {
    throw new ScanTokenError('Scan token machine could not be resolved', 404, 'machine_not_found');
  }

  const issuedAt = new Date(payload.issuedAt * 1000);
  const expiresAt = new Date(payload.expiresAt * 1000);

  const tokenRecord =
    (await prisma.machineScanToken.findUnique({
      where: { tokenHash },
    })) ??
    (await prisma.machineScanToken.create({
      data: {
        tokenHash,
        branchId: payload.branchId,
        machineId: payload.machineId,
        issuedAt,
        expiresAt,
        nonce: payload.nonce,
      },
    }).catch(async (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return prisma.machineScanToken.findUniqueOrThrow({
          where: { tokenHash },
        });
      }

      throw error;
    }));

  if (tokenRecord.consumedAt) {
    throw new ScanTokenError('Scan token has already been consumed', 409, 'consumed_scan_token');
  }

  const branch = machine.branch;
  return {
    branch: mapCustomerBranch({
      ...branch,
      supportPhone: branch.settings?.supportPhone ?? null,
      timezone: branch.settings?.timezone ?? 'Asia/Bangkok',
      machines: branch.machines.map((branchMachine) => mapCustomerMachine(branchMachine)),
      packages: branch.packageConfigs.map((config) =>
        mapCustomerPackage({
          id: config.package.id,
          name: config.displayName ?? config.package.name,
          description: config.descriptionOverride ?? config.package.description,
          vehicleType: config.package.vehicleType,
          prices: {
            S: config.priceOverrideS ?? config.package.priceS,
            M: config.priceOverrideM ?? config.package.priceM,
            L: config.priceOverrideL ?? config.package.priceL,
          },
          steps: config.package.steps,
          stepDuration: config.package.stepDuration,
          features: config.package.features,
          isActive: config.package.isActive,
          image: config.package.image,
        })
      ),
    }),
    machine: mapCustomerMachine(machine),
    scan: {
      tokenId: tokenRecord.id,
      expiresAt: expiresAt.toISOString(),
      nonce: tokenRecord.nonce,
    },
  };
}

type TransactionClient = Prisma.TransactionClient;

export async function getValidScanTokenForSession(params: {
  tx?: TransactionClient;
  scanTokenId: string;
  branchId: string;
  machineId: string;
}) {
  const client = params.tx ?? prisma;
  const tokenRecord = await client.machineScanToken.findUnique({
    where: { id: params.scanTokenId },
  });

  if (!tokenRecord) {
    throw new ScanTokenError('Scan token could not be found', 404, 'invalid_scan_token');
  }

  if (tokenRecord.branchId !== params.branchId || tokenRecord.machineId !== params.machineId) {
    throw new ScanTokenError(
      'Scan token does not match the selected branch or machine',
      400,
      'invalid_scan_token'
    );
  }

  if (tokenRecord.expiresAt <= new Date()) {
    throw new ScanTokenError('Scan token has expired', 410, 'expired_scan_token');
  }

  if (tokenRecord.consumedAt) {
    throw new ScanTokenError('Scan token has already been consumed', 409, 'consumed_scan_token');
  }

  return tokenRecord;
}
