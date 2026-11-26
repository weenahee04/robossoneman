import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
export const contentRoutes = new Hono();
contentRoutes.get('/:kind', async c => {
  const kind = c.req.param('kind');
  if (!['faq', 'article'].includes(kind)) return c.json({ message: 'Not found' }, 404);
  const [data, total] = await Promise.all([
    prisma.appContent.findMany({ where: { kind, isPublished: true }, select: { id: true, slug: true, title: true, body: true, category: true, imageUrl: true, updatedAt: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.appContent.count({ where: { kind } }),
  ]);
  return c.json({ data, configured: total > 0 });
});
