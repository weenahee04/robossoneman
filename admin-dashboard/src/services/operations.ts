import { request } from './api';
export interface PageResult<T> { data: T[]; total: number; page: number; limit: number }
export interface PointsCustomer { id: string; displayName: string; phone: string | null; tier: string; isActive: boolean; wallet: null | { balance: number; lifetimeEarned: number; lifetimeRedeemed: number } }
export interface PointEntry { id: string; type: string; amount: number; balanceAfter: number; description: string; branchId: string | null; createdAt: string }
export interface AuditEntry { id: string; action: string; actorType: string; entityType: string; entityId: string | null; createdAt: string; adminUser: { name: string } | null; branch: { name: string } | null }
export interface PlanDraft { code: string; name: string; description: string | null; price: number; durationMonths: number; group: 'membership' | 'bundle' | 'motorcycle'; washLimit: number; grapheneLimit: number; freeVacuumPerVisit: boolean; vipFastLane: boolean; isActive: boolean; sortOrder: number }
export interface PlanRecord extends PlanDraft { id: string; _count: { memberships: number } }
export interface ContentDraft { kind: 'faq' | 'article'; slug: string; title: string; body: string; category: string; imageUrl: string | null; isPublished: boolean; sortOrder: number }
export interface ContentRecord extends ContentDraft { id: string; version: number; updatedAt: string }
export function query(path: string, params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  return `/api/admin/${path}?${search}`;
}
export const operations = {
  get: request,
  adjustPoints: (userId: string, data: { amount: number; reason: string; requestId: string }) => request<{ data: PointEntry }>(`/api/admin/points/${encodeURIComponent(userId)}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  createPlan: (data: PlanDraft) => request('/api/admin/membership-plans', { method: 'POST', body: JSON.stringify(data) }),
  activatePlan: (id: string, isActive: boolean) => request(`/api/admin/membership-plans/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  saveContent: (data: ContentDraft, existing?: { id: string; version: number }) => request<{ data: ContentRecord }>(`/api/admin/content${existing ? `/${encodeURIComponent(existing.id)}` : ''}`, { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ ...data, ...(existing ? { version: existing.version } : {}) }) }),
};
