import type {
  AdminUser,
  Branch,
  Machine,
  WashSession,
  Customer,
} from './mockData';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'roboss_admin_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────

export interface LoginResponse {
  data: {
    admin: {
      id: string;
      email: string;
      name: string;
      role: string;
      branchIds: string[];
    };
    token: string;
  };
}

export async function login(
  email: string,
  password: string,
): Promise<AdminUser> {
  const res = await request<LoginResponse>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(res.data.token);
  return {
    uid: res.data.admin.id,
    email: res.data.admin.email,
    displayName: res.data.admin.name,
    role: res.data.admin.role as AdminUser['role'],
    branchIds: res.data.admin.branchIds,
    createdAt: new Date(),
  };
}

export function logout() {
  clearToken();
}

// ─── Dashboard ─────────────────────────────────────────────────

export interface DashboardResponse {
  data: {
    totalBranches: number;
    totalMachines: number;
    activeMachines: number;
    todaySessions: number;
    todayRevenue: number;
    totalCustomers: number;
    recentSessions: Array<{
      id: string;
      customerName: string;
      packageName: string;
      carSize: string;
      totalPrice: number;
      washStatus: string;
      branchName: string;
      createdAt: string;
    }>;
  };
}

export async function fetchDashboard() {
  return request<DashboardResponse>('/api/admin/dashboard');
}

// ─── Branches ──────────────────────────────────────────────────

export interface BranchesResponse {
  data: Array<{
    id: string;
    name: string;
    address: string;
    area: string;
    lat: number;
    lng: number;
    mapsUrl?: string;
    promptPayId: string;
    ownerId: string;
    isActive: boolean;
    openTime: string;
    closeTime: string;
    machines?: Array<{
      id: string;
      name: string;
      status: string;
    }>;
    _count?: { machines: number; sessions: number };
    todayRevenue?: number;
    todaySessions?: number;
    avgRating?: number;
  }>;
}

export async function fetchBranches(): Promise<Branch[]> {
  const res = await request<BranchesResponse>('/api/admin/branches');
  return res.data.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    area: b.area || '',
    location: { lat: b.lat || 0, lng: b.lng || 0 },
    mapsUrl: b.mapsUrl,
    promptPayId: b.promptPayId || '',
    ownerId: b.ownerId || '',
    isActive: b.isActive,
    operatingHours: { open: b.openTime || '07:00', close: b.closeTime || '21:00' },
    machineCount: b._count?.machines ?? b.machines?.length ?? 0,
    todayRevenue: b.todayRevenue ?? 0,
    todaySessions: b._count?.sessions ?? b.todaySessions ?? 0,
    avgRating: b.avgRating ?? 0,
  }));
}

export async function createBranch(data: Partial<Branch>) {
  return request('/api/admin/branches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  return request(`/api/admin/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Machines ──────────────────────────────────────────────────

export interface MachinesResponse {
  data: Array<{
    id: string;
    branchId: string;
    name: string;
    type: string;
    status: string;
    espDeviceId: string;
    lastHeartbeat: string;
    totalWashes: number;
    currentSessionId?: string;
    branch?: { name: string };
  }>;
}

export async function fetchMachines(): Promise<Machine[]> {
  const res = await request<MachinesResponse>('/api/admin/machines');
  return res.data.map((m) => ({
    id: m.id,
    branchId: m.branchId,
    branchName: m.branch?.name || '',
    name: m.name,
    type: m.type as Machine['type'],
    status: m.status as Machine['status'],
    espDeviceId: m.espDeviceId || '',
    lastHeartbeat: new Date(m.lastHeartbeat),
    totalWashes: m.totalWashes || 0,
    currentSessionId: m.currentSessionId,
  }));
}

export async function sendMachineCommand(
  machineId: string,
  command: 'restart' | 'maintenance_on' | 'maintenance_off',
) {
  return request(`/api/admin/machines/${machineId}/command`, {
    method: 'POST',
    body: JSON.stringify({ command }),
  });
}

// ─── Sessions ──────────────────────────────────────────────────

export interface SessionsResponse {
  data: Array<{
    id: string;
    branchId: string;
    machineId: string;
    userId: string;
    customerName: string;
    packageName: string;
    carSize: string;
    totalPrice: number;
    paymentStatus: string;
    washStatus: string;
    rating: number | null;
    createdAt: string;
    completedAt: string | null;
    branch?: { name: string };
  }>;
  total: number;
  page: number;
  limit: number;
}

export async function fetchSessions(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ sessions: WashSession[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status && params.status !== 'all') qs.set('status', params.status);

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await request<SessionsResponse>(`/api/admin/sessions${query}`);

  return {
    sessions: res.data.map((s) => ({
      id: s.id,
      branchId: s.branchId,
      branchName: s.branch?.name || '',
      machineId: s.machineId,
      userId: s.userId || '',
      customerName: s.customerName || '',
      packageName: s.packageName || '',
      carSize: s.carSize as WashSession['carSize'],
      totalPrice: s.totalPrice,
      paymentStatus: s.paymentStatus as WashSession['paymentStatus'],
      washStatus: s.washStatus as WashSession['washStatus'],
      rating: s.rating,
      createdAt: new Date(s.createdAt),
      completedAt: s.completedAt ? new Date(s.completedAt) : null,
    })),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// ─── Revenue ───────────────────────────────────────────────────

export interface RevenueResponse {
  data: {
    dailyRevenue: Array<{ date: string; total: number }>;
    totalRevenue: number;
    sessionCount: number;
    period: number;
  };
}

export async function fetchRevenue(days: number = 30) {
  return request<RevenueResponse>(`/api/admin/revenue?days=${days}`);
}

// ─── Customers ─────────────────────────────────────────────────

export interface CustomersResponse {
  data: Array<{
    id: string;
    lineUserId: string;
    displayName: string;
    phone?: string;
    points: number;
    totalWashes: number;
    totalSpend: number;
    memberTier: string;
    memberSince: string;
    lastWash: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
}

export async function fetchCustomers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ customers: Customer[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await request<CustomersResponse>(`/api/admin/customers${query}`);

  return {
    customers: res.data.map((c) => ({
      id: c.id,
      lineUserId: c.lineUserId || '',
      displayName: c.displayName,
      phone: c.phone,
      points: c.points,
      totalWashes: c.totalWashes,
      totalSpend: c.totalSpend,
      memberTier: c.memberTier as Customer['memberTier'],
      memberSince: new Date(c.memberSince),
      lastWash: c.lastWash ? new Date(c.lastWash) : null,
    })),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

// ─── Utility ───────────────────────────────────────────────────

export const USE_API = !!import.meta.env.VITE_API_URL;

const api = {
  login,
  logout,
  fetchDashboard,
  fetchBranches,
  createBranch,
  updateBranch,
  fetchMachines,
  sendMachineCommand,
  fetchSessions,
  fetchRevenue,
  fetchCustomers,
  USE_API,
};

export default api;
