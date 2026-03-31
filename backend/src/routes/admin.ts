import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';
import { requireAdmin } from '../middleware/auth.js';
import { publishMachineCommand } from '../services/mqtt.js';
import type { AppEnv } from '../lib/types.js';

export const adminRoutes = new Hono<AppEnv>();

// ── Admin Auth ────────────────────────────────────────────

adminRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = z
    .object({ email: z.string().email(), password: z.string().min(6) })
    .parse(body);

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !admin.isActive) {
    return c.json({ message: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return c.json({ message: 'Invalid credentials' }, 401);
  }

  const token = signAccessToken(admin.id);

  return c.json({
    data: {
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        branchIds: admin.branchIds,
      },
      token,
    },
  });
});

// ── Protected admin routes ────────────────────────────────

// Dashboard overview
adminRoutes.get('/dashboard', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  const branchFilter =
    role === 'hq' ? {} : { branchId: { in: admin?.branchIds || [] } };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalBranches,
    totalMachines,
    activeMachines,
    todaySessions,
    todayRevenue,
    totalCustomers,
    recentSessions,
  ] = await Promise.all([
    prisma.branch.count({ where: role === 'hq' ? {} : { id: { in: admin?.branchIds || [] } } }),
    prisma.machine.count({ where: branchFilter }),
    prisma.machine.count({ where: { ...branchFilter, status: { not: 'offline' } } }),
    prisma.washSession.count({ where: { ...branchFilter, createdAt: { gte: today } } }),
    prisma.washSession.aggregate({
      where: { ...branchFilter, paymentStatus: 'paid', createdAt: { gte: today } },
      _sum: { totalPrice: true },
    }),
    prisma.user.count(),
    prisma.washSession.findMany({
      where: branchFilter,
      include: {
        branch: { select: { name: true } },
        package: { select: { name: true } },
        user: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return c.json({
    data: {
      totalBranches,
      totalMachines,
      activeMachines,
      todaySessions,
      todayRevenue: todayRevenue._sum.totalPrice || 0,
      totalCustomers,
      recentSessions,
    },
  });
});

// ── Branch Management ─────────────────────────────────────

adminRoutes.get('/branches', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });

  const where = role === 'hq' ? {} : { id: { in: admin?.branchIds || [] } };

  const branches = await prisma.branch.findMany({
    where,
    include: {
      machines: true,
      _count: { select: { sessions: true } },
    },
    orderBy: { name: 'asc' },
  });

  return c.json({ data: branches });
});

adminRoutes.post('/branches', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  if (role !== 'hq') {
    return c.json({ message: 'Only HQ can create branches' }, 403);
  }

  const body = await c.req.json();
  const data = z
    .object({
      name: z.string().min(1),
      address: z.string().min(1),
      area: z.string().min(1),
      lat: z.number(),
      lng: z.number(),
      promptPayId: z.string(),
      promptPayName: z.string(),
    })
    .parse(body);

  const branch = await prisma.branch.create({ data });
  return c.json({ data: branch }, 201);
});

adminRoutes.patch('/branches/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const branch = await prisma.branch.update({
    where: { id },
    data: body,
  });

  return c.json({ data: branch });
});

// ── Machine Management ────────────────────────────────────

adminRoutes.get('/machines', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });

  const where = role === 'hq' ? {} : { branchId: { in: admin?.branchIds || [] } };

  const machines = await prisma.machine.findMany({
    where,
    include: { branch: { select: { name: true } } },
    orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
  });

  return c.json({ data: machines });
});

adminRoutes.post('/machines/:id/command', requireAdmin, async (c) => {
  const machineId = c.req.param('id');
  const body = await c.req.json();
  const { command } = z
    .object({ command: z.enum(['restart', 'maintenance_on', 'maintenance_off']) })
    .parse(body);

  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: { branch: true },
  });

  if (!machine) return c.json({ message: 'Machine not found' }, 404);

  const sent = publishMachineCommand(machine.branchId, machine.espDeviceId, command);

  if (command === 'maintenance_on') {
    await prisma.machine.update({
      where: { id: machineId },
      data: { status: 'maintenance' },
    });
  } else if (command === 'maintenance_off') {
    await prisma.machine.update({
      where: { id: machineId },
      data: { status: 'idle' },
    });
  }

  return c.json({
    data: { message: `Command ${command} ${sent ? 'sent' : 'queued (MQTT offline)'}` },
  });
});

// ── Session Management ────────────────────────────────────

adminRoutes.get('/sessions', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });

  const branchFilter =
    role === 'hq' ? {} : { branchId: { in: admin?.branchIds || [] } };

  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 50);
  const status = c.req.query('status');

  const where: Record<string, unknown> = { ...branchFilter };
  if (status) where.washStatus = status;

  const [sessions, total] = await Promise.all([
    prisma.washSession.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        package: { select: { name: true } },
        user: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.washSession.count({ where }),
  ]);

  return c.json({ data: sessions, total, page, limit });
});

// ── Revenue ───────────────────────────────────────────────

adminRoutes.get('/revenue', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  const adminId = c.get('adminId');
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  const days = Number(c.req.query('days') || 30);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const branchFilter =
    role === 'hq' ? {} : { branchId: { in: admin?.branchIds || [] } };

  const sessions = await prisma.washSession.findMany({
    where: {
      ...branchFilter,
      paymentStatus: 'paid',
      createdAt: { gte: since },
    },
    select: {
      totalPrice: true,
      createdAt: true,
      branchId: true,
      packageId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate by day
  const dailyMap = new Map<string, number>();
  sessions.forEach((s) => {
    const day = s.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + s.totalPrice);
  });

  const dailyRevenue = Array.from(dailyMap.entries()).map(([date, total]) => ({
    date,
    total,
  }));

  const totalRevenue = sessions.reduce((sum, s) => sum + s.totalPrice, 0);

  return c.json({
    data: {
      dailyRevenue,
      totalRevenue,
      sessionCount: sessions.length,
      period: days,
    },
  });
});

// ── Customer Management ───────────────────────────────────

adminRoutes.get('/customers', requireAdmin, async (c) => {
  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 50);
  const search = c.req.query('search');

  const where = search
    ? { displayName: { contains: search, mode: 'insensitive' as const } }
    : {};

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        phone: true,
        tier: true,
        totalPoints: true,
        totalWashes: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return c.json({ data: customers, total, page, limit });
});

// ── Admin User Management (HQ only) ──────────────────────

adminRoutes.post('/users', requireAdmin, async (c) => {
  const role = c.get('adminRole');
  if (role !== 'hq') {
    return c.json({ message: 'Only HQ can create admin users' }, 403);
  }

  const body = await c.req.json();
  const data = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.enum(['hq', 'franchise_owner', 'branch_manager']),
      branchIds: z.array(z.string()).default([]),
    })
    .parse(body);

  const passwordHash = await bcrypt.hash(data.password, 12);

  const admin = await prisma.adminUser.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role,
      branchIds: data.branchIds,
    },
  });

  return c.json(
    {
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        branchIds: admin.branchIds,
      },
    },
    201
  );
});
