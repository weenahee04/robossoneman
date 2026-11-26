# ROBOSS Admin — local runtime

The local admin uses an isolated Prisma Local Postgres database. It does not require an SSH tunnel and does not connect to the production database.

## Start after restarting Windows

```powershell
cd C:\Users\PC\Downloads\robossoneman\backend
npx prisma dev start roboss-local
npm run dev
```

In a second terminal:

```powershell
cd C:\Users\PC\Downloads\robossoneman\admin-dashboard
npm run dev -- --host 127.0.0.1 --port 5181
```

Open `http://127.0.0.1:5181/`.

## Local accounts

| Role | Email | Password |
|---|---|---|
| Headquarters | `admin@roboss.co.th` | `admin123` |
| Branch administrator | `rama.manager@roboss.co.th` | `manager123` |
| Cashier | `cashier@roboss.co.th` | `cashier123` |

## Local services

- Admin dashboard: `http://127.0.0.1:5181/`
- Customer app: `http://127.0.0.1:5173/`
- API health: `http://localhost:3001/health`
- MQTT is disabled locally. Simulated wash mode remains available for application testing.

Run migrations and seed only when intentionally rebuilding local data:

```powershell
cd C:\Users\PC\Downloads\robossoneman\backend
npx prisma migrate deploy
npm run db:seed
```
