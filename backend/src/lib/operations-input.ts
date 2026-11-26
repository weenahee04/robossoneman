import { z } from 'zod';

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  branchId: z.string().min(1).max(100).optional(),
});
export const pointsAdjustment = z.object({
  amount: z.number().int().min(-1000000).max(1000000).refine(value => value !== 0, 'จำนวนต้องไม่เป็นศูนย์'),
  reason: z.string().trim().min(5).max(500),
  requestId: z.string().uuid(),
}).strict();
export const membershipPlanInput = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{2,64}$/),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().default(null),
  price: z.number().int().min(1).max(1000000),
  durationMonths: z.number().int().min(1).max(60),
  group: z.enum(['membership', 'bundle', 'motorcycle']),
  washLimit: z.number().int().min(1).max(10000),
  grapheneLimit: z.number().int().min(0).max(10000),
  freeVacuumPerVisit: z.boolean(),
  vipFastLane: z.boolean(),
  isActive: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
}).strict().refine(value => value.grapheneLimit <= value.washLimit, 'สิทธิ์เคลือบต้องไม่มากกว่าจำนวนล้าง');
export const contentInput = z.object({
  kind: z.enum(['faq', 'article']),
  slug: z.string().trim().regex(/^[a-z0-9_-]{2,100}$/),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(30000),
  category: z.string().trim().max(100).default('ทั่วไป'),
  imageUrl: z.union([z.literal(''), z.string().url().max(2000).refine(value => new URL(value).protocol === 'https:', 'รูปภาพต้องใช้ HTTPS')]).nullable().default(null),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
}).strict();
