import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import type { AppEnv } from '../lib/types.js';
import { assistantInput, requestAssistantReply } from '../services/assistant.js';

export const assistantRoutes = new Hono<AppEnv>();
const limits = new Map<string, { count: number; reset: number; busy: boolean }>();
const configured = () => Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_ASSISTANT_MODEL?.trim());
assistantRoutes.use('*', requireAuth);
assistantRoutes.get('/status', c => c.json({ data: { available: configured() } }));
assistantRoutes.post('/chat', bodyLimit({ maxSize: 32768, onError: c => c.json({ message: 'ข้อความยาวเกินไป' }, 413) }), async c => {
  const parsed = assistantInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: 'กรุณาส่งข้อความไม่เกิน 1,500 ตัวอักษร' }, 400);
  if (!configured()) return c.json({ message: 'ผู้ช่วย AI ยังไม่พร้อมใช้งาน กรุณาติดต่อพนักงาน', code: 'ASSISTANT_NOT_CONFIGURED' }, 503);
  const now = Date.now();
  for (const [key, entry] of limits) if (entry.reset <= now && !entry.busy) limits.delete(key);
  const userId = c.get('userId');
  if (!limits.has(userId) && limits.size >= 10000) return c.json({ message: 'มีผู้ใช้งานจำนวนมาก กรุณาลองอีกครั้ง' }, 429);
  const limit = limits.get(userId) ?? { count: 0, reset: now + 60000, busy: false };
  if (limit.busy || limit.count >= 10) { c.header('Retry-After', '60'); return c.json({ message: 'กรุณารอสักครู่แล้วลองอีกครั้ง' }, 429); }
  limit.count++; limit.busy = true; limits.set(userId, limit);
  try {
    const faqs = await prisma.appContent.findMany({ where: { kind: 'faq', isPublished: true }, select: { title: true, body: true }, orderBy: { sortOrder: 'asc' }, take: 8 });
    const faq = JSON.stringify(faqs.map(item => ({ title: item.title.slice(0, 150), body: item.body.slice(0, 550) })));
    const reply = await requestAssistantReply(parsed.data.messages, faq, { key: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_ASSISTANT_MODEL! });
    return c.json({ data: { reply } });
  } catch {
    return c.json({ message: 'ผู้ช่วยตอบไม่ได้ในขณะนี้ ลองอีกครั้งหรือติดต่อพนักงาน' }, 502);
  } finally { limit.busy = false; }
});
