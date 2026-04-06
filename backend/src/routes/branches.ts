import { Hono } from 'hono';
import { z } from 'zod';
import { mapCustomerBranch, mapCustomerMachine, mapCustomerPackage } from '../lib/mappers.js';
import { prisma } from '../lib/prisma.js';
import { resolveBranchMachineFromQr } from '../services/wash-flow.js';
import {
  createMachineScanToken,
  resolveBranchMachineFromScanToken,
  ScanTokenError,
} from '../services/scan-tokens.js';

export const branchRoutes = new Hono();

branchRoutes.post('/resolve-scan', async (c) => {
  const body = await c.req.json();
  const payload = z
    .object({
      scanToken: z.string().min(1).optional(),
      qrData: z.string().min(1).optional(),
    })
    .refine((value) => Boolean(value.scanToken || value.qrData), {
      message: 'scanToken or qrData is required',
    })
    .parse(body);

  try {
    if (payload.scanToken) {
      const resolved = await resolveBranchMachineFromScanToken(payload.scanToken);
      return c.json({ data: resolved });
    }

    const resolved = await resolveBranchMachineFromQr(payload.qrData!);
    if (!resolved) {
      return c.json({ message: 'QR code is invalid or machine not found' }, 404);
    }

    const { token } = createMachineScanToken({
      branchId: resolved.branch.id,
      machineId: resolved.machine.id,
      machineCode: resolved.machine.code,
    });
    const tokenResolved = await resolveBranchMachineFromScanToken(token);

    return c.json({
      data: {
        qrData: payload.qrData,
        ...tokenResolved,
      },
    });
  } catch (error) {
    if (error instanceof ScanTokenError) {
      const status = (() => {
        switch (error.status) {
          case 404:
            return 404 as const;
          case 409:
            return 409 as const;
          case 410:
            return 410 as const;
          default:
            return 400 as const;
        }
      })();

      return c.json(
        {
          message: error.message,
          code: error.code,
        },
        status
      );
    }

    throw error;
  }
});

branchRoutes.get('/', async (c) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
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
        include: {
          package: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const data = branches.map((branch) =>
    mapCustomerBranch({
      ...branch,
      supportPhone: branch.settings?.supportPhone ?? null,
      timezone: branch.settings?.timezone ?? 'Asia/Bangkok',
      machines: branch.machines.map((machine) => mapCustomerMachine(machine)),
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
    })
  );

  return c.json({ data });
});

branchRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      settings: true,
      machines: true,
      packageConfigs: {
        where: { isActive: true, isVisible: true },
        include: { package: true },
      },
    },
  });

  if (!branch) {
    return c.json({ message: 'Branch not found' }, 404);
  }

  return c.json({
    data: mapCustomerBranch({
      ...branch,
      supportPhone: branch.settings?.supportPhone ?? null,
      timezone: branch.settings?.timezone ?? 'Asia/Bangkok',
      machines: branch.machines.map((machine) => mapCustomerMachine(machine)),
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
  });
});
