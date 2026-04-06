# ROBOSS Secret Setup Checklist

ไฟล์นี้ใช้เป็น checklist ตอนย้ายไป IDE/เครื่องใหม่

ข้อสำคัญ:
- ห้าม commit ค่าจริงของ secret ลง Git แม้ repo จะเป็น private
- ให้เก็บ secret ใน environment variables ของเครื่อง, Render, Vercel, หรือ secret manager
- คีย์ที่เคยพิมพ์ในแชต/รูปหน้าจอควร rotate หลังย้ายระบบเสร็จ

## Frontend

ตั้งค่าจากไฟล์ตัวอย่าง:
- `C:\Users\PC\Downloads\roboare\robossoneman\.env.example`

ตัวแปรหลัก:
- `VITE_API_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_SIGN_IN_FORCE_REDIRECT_URL`
- `VITE_CLERK_SIGN_UP_FORCE_REDIRECT_URL`
- `VITE_LINE_RICH_MENU_ENTRY_URL`

## Backend

ตั้งค่าจากไฟล์ตัวอย่าง:
- `C:\Users\PC\Downloads\roboare\robossoneman\backend\.env.example`
- `C:\Users\PC\Downloads\roboare\robossoneman\backend\.env.railway.staging.example`

ตัวแปรหลัก:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SCAN_TOKEN_SECRET`
- `BRANCH_PAYMENT_CREDENTIAL_SECRET`
- `PAYMENT_PROVIDER_NAME`
- `PAYMENT_PROVIDER_WEBHOOK_SECRET`
- `CORS_ORIGIN`
- `CLERK_AUTH_MODE`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_KEY`
- `CLERK_WEBHOOK_SECRET`
- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `SLIPMATE_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Render

service:
- `roboss-backend-staging`

เช็กให้มีอย่างน้อย:
- `PAYMENT_PROVIDER_NAME=stripe`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SCAN_TOKEN_SECRET`
- `BRANCH_PAYMENT_CREDENTIAL_SECRET`

หลังย้ายหรือเปลี่ยนค่า env:
1. Save changes
2. Manual Deploy
3. Clear build cache & deploy
4. ถ้าจำเป็น run
```bash
npx prisma db push --schema prisma/schema.prisma --force-reset
npm run db:seed
```

## Vercel

project:
- `roboss-portal`

เช็กให้มี:
- `VITE_API_URL=https://roboss-backend-staging.onrender.com`

หลังเปลี่ยน env:
1. Redeploy production
2. Hard refresh หรือเปิด incognito

## Stripe

ค่าที่ต้องใช้:
- `sk_live_...` สำหรับ `STRIPE_SECRET_KEY`
- `whsec_...` สำหรับ `STRIPE_WEBHOOK_SECRET`

Webhook endpoint:
- `https://roboss-backend-staging.onrender.com/api/payments/webhook/provider`

events ที่แนะนำ:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`

## หลังย้ายเสร็จ

ควร rotate ใหม่:
- Stripe live secret key
- Stripe webhook secret
- Clerk keys
- LINE secrets
- JWT secrets
- DATABASE_URL ถ้ามีโอกาสหลุด

