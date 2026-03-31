# ROBOSS Deployment Guide

## Architecture

```
Consumer Mini-App (Netlify) ──> Hono Backend (Railway) ──> PostgreSQL (Neon)
Admin Dashboard (Netlify)   ──┘         │
                                   MQTT (optional) ──> ESP32 Machines
                                   WebSocket ──> Real-time updates
```

## Step 1: Provision Neon PostgreSQL

1. Go to https://neon.tech and create a free account
2. Create a new project named `roboss`
3. Copy the connection string (looks like `postgresql://neondb_owner:xxx@xxx.neon.tech/neondb?sslmode=require`)
4. Paste it into `backend/.env` as `DATABASE_URL`

## Step 2: Initialize Database

```bash
cd backend
npm install
npx prisma db push     # Create tables
npm run db:seed         # Seed branches, packages, coupons, promotions, admin users
```

## Step 3: Test Backend Locally

```bash
cd backend
npm run dev    # Starts on http://localhost:3001
```

Test endpoints:
- `GET http://localhost:3001/` → API info
- `POST http://localhost:3001/api/auth/dev-login` → `{ "lineUserId": "dev_user_001" }`
- `GET http://localhost:3001/api/branches` → All branches
- `POST http://localhost:3001/api/admin/login` → `{ "email": "admin@roboss.co.th", "password": "admin123" }`

## Step 4: Test Frontend with Backend

```bash
# In root directory
npm run dev    # Starts on http://localhost:5173
```

The frontend `.env` is pre-configured to connect to `http://localhost:3001/api`.

## Step 5: Deploy Backend to Railway

1. Go to https://railway.app and create a new project
2. Connect the `backend` directory as a service
3. Set environment variables:
   - `DATABASE_URL` = your Neon connection string
   - `JWT_SECRET` = a strong random string
   - `JWT_REFRESH_SECRET` = a different strong random string
   - `CORS_ORIGIN` = `https://roboss-master.netlify.app`
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
4. Railway will auto-detect `npm run build` and `npm run start`

## Step 6: Redeploy Frontend with Production API

Update `.env`:
```
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=wss://your-backend.railway.app/ws
```

Then rebuild and deploy:
```bash
npm run build
npx netlify-cli deploy --dir=dist --prod
```

## URLs

- **Consumer**: https://roboss-master.netlify.app
- **Admin**: https://roboss-master.netlify.app/admin.html

## Admin Credentials (Seeded)

| Email | Password | Role |
|-------|----------|------|
| admin@roboss.co.th | admin123 | HQ Admin |
| manager@roboss.co.th | manager123 | Branch Manager |
| franchise@roboss.co.th | franchise123 | Franchise Owner |
