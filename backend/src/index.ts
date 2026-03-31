import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { branchRoutes } from './routes/branches.js';
import { packageRoutes } from './routes/packages.js';
import { sessionRoutes } from './routes/sessions.js';
import { pointsRoutes } from './routes/points.js';
import { couponRoutes } from './routes/coupons.js';
import { stampRoutes } from './routes/stamps.js';
import { notificationRoutes } from './routes/notifications.js';
import { feedbackRoutes } from './routes/feedback.js';
import { referralRoutes } from './routes/referrals.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { promotionRoutes } from './routes/promotions.js';
import { adminRoutes } from './routes/admin.js';
import { initMqtt } from './services/mqtt.js';
import { initWebSocket } from './services/websocket.js';

const app = new Hono();

// Multi-origin CORS support
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return allowedOrigins[0];
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    },
    credentials: true,
  })
);

app.get('/', (c) =>
  c.json({ message: 'ROBOSS Car Wash API', version: '2.0.0' })
);

app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/branches', branchRoutes);
app.route('/api/packages', packageRoutes);
app.route('/api/sessions', sessionRoutes);
app.route('/api/points', pointsRoutes);
app.route('/api/coupons', couponRoutes);
app.route('/api/stamps', stampRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/feedback', feedbackRoutes);
app.route('/api/referrals', referralRoutes);
app.route('/api/vehicles', vehicleRoutes);
app.route('/api/promotions', promotionRoutes);
app.route('/api/admin', adminRoutes);

app.notFound((c) => c.json({ message: 'Not Found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    { message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message },
    500
  );
});

const port = Number(process.env.PORT) || 3001;

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ROBOSS API running on http://localhost:${info.port}`);
});

// Bootstrap optional services
initMqtt();
initWebSocket(server as ReturnType<typeof import('http').createServer>);

export default app;
