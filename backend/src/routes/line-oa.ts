import { Hono } from 'hono';
import {
  buildLineOaReply,
  isLineOaConfigured,
  replyLineMessages,
  verifyLineSignature,
} from '../services/line-oa.js';
import type { AppEnv } from '../lib/types.js';

export const lineOaRoutes = new Hono<AppEnv>();

lineOaRoutes.get('/health', (c) =>
  c.json({
    data: {
      configured: isLineOaConfigured(),
      webhookPath: '/api/line/webhook',
    },
  })
);

lineOaRoutes.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-line-signature');

  if (!verifyLineSignature(rawBody, signature)) {
    return c.json({ message: 'Invalid LINE signature' }, 401);
  }

  const payload = JSON.parse(rawBody) as { events?: any[] };
  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const event of events) {
    if (!event.replyToken || event.replyToken === '00000000000000000000000000000000') {
      continue;
    }

    if (!['follow', 'message', 'postback'].includes(event.type)) {
      continue;
    }

    try {
      const messages = await buildLineOaReply(event);
      await replyLineMessages(event.replyToken, messages);
    } catch (error) {
      console.error('[line-oa-webhook] failed to reply', {
        eventType: event.type,
        lineUserId: event.source?.userId,
        error,
      });
    }
  }

  return c.json({ data: { received: events.length } });
});
