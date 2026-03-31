import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';

export const branchRoutes = new Hono();

branchRoutes.get('/', async (c) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    include: {
      machines: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          espDeviceId: true,
        },
      },
      packages: {
        include: {
          package: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const data = branches.map((b) => ({
    id: b.id,
    name: b.name,
    shortName: b.shortName,
    address: b.address,
    area: b.area,
    type: b.type,
    location: { lat: b.lat, lng: b.lng },
    mapsUrl: b.mapsUrl,
    hours: b.hours,
    promptPayId: b.promptPayId,
    promptPayName: b.promptPayName,
    isActive: b.isActive,
    machines: b.machines,
    packages: b.packages.map((bp) => ({
      id: bp.package.id,
      name: bp.package.name,
      description: bp.package.description,
      vehicleType: bp.package.vehicleType,
      prices: {
        S: bp.priceOverrideS ?? bp.package.priceS,
        M: bp.priceOverrideM ?? bp.package.priceM,
        L: bp.priceOverrideL ?? bp.package.priceL,
      },
      steps: bp.package.steps,
      stepDuration: bp.package.stepDuration,
      features: bp.package.features,
      isActive: bp.package.isActive,
      image: bp.package.image,
    })),
  }));

  return c.json({ data });
});

branchRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      machines: true,
      packages: { include: { package: true } },
    },
  });

  if (!branch) {
    return c.json({ message: 'Branch not found' }, 404);
  }

  return c.json({
    data: {
      id: branch.id,
      name: branch.name,
      shortName: branch.shortName,
      address: branch.address,
      area: branch.area,
      type: branch.type,
      location: { lat: branch.lat, lng: branch.lng },
      mapsUrl: branch.mapsUrl,
      hours: branch.hours,
      promptPayId: branch.promptPayId,
      promptPayName: branch.promptPayName,
      isActive: branch.isActive,
      machines: branch.machines.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        status: m.status,
        espDeviceId: m.espDeviceId,
      })),
      packages: branch.packages.map((bp) => ({
        id: bp.package.id,
        name: bp.package.name,
        vehicleType: bp.package.vehicleType,
        prices: {
          S: bp.priceOverrideS ?? bp.package.priceS,
          M: bp.priceOverrideM ?? bp.package.priceM,
          L: bp.priceOverrideL ?? bp.package.priceL,
        },
        steps: bp.package.steps,
        stepDuration: bp.package.stepDuration,
        isActive: bp.package.isActive,
        image: bp.package.image,
      })),
    },
  });
});
