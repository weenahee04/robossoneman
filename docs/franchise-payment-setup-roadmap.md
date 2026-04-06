# ROBOSS Franchise Payment Setup Roadmap

เอกสารนี้สรุปแผนงานสำหรับ 2 เรื่องที่ต้องเดินคู่กัน:

1. เปลี่ยน flow หน้าลูกค้าเป็น `scan token -> session -> payment QR -> machine start`
2. ออกแบบระบบหลังบ้านให้ `เจ้าของแฟรนไชส์ตั้งค่า payment ของสาขาตัวเองได้`

เป้าหมายคือให้ ROBOSS รองรับการขยายหลายสาขา หลายเจ้าของ และให้แต่ละแฟรนไชส์สามารถใช้ปลายทางรับเงินของตัวเองได้ โดยยังคงให้ระบบกลางเป็นตัวควบคุม flow, audit และ machine safety

---

## วิสัยทัศน์สุดท้าย

### ฝั่งลูกค้า

1. ลูกค้าสแกน QR ที่ตู้
2. ระบบ verify ว่าเป็น scan ที่ valid ของเครื่องนี้จริง
3. ลูกค้าเลือกแพ็กเกจ
4. ระบบสร้าง session + payment reference
5. ระบบแสดง payment QR ของสาขานั้น
6. ระบบตรวจว่าจ่ายเงินจริงสำหรับ order นี้
7. session ถูกปลดเป็น `ready_to_wash`
8. ลูกค้ากดเริ่มล้าง
9. backend ส่ง command ไปที่เครื่องจริง

### ฝั่งหลังบ้าน

1. HQ กำหนดว่าแต่ละสาขาใช้ provider/payment mode แบบไหน
2. เจ้าของแฟรนไชส์หรือ branch admin ที่ได้รับสิทธิ์ สามารถกรอกปลายทางรับเงินของตัวเอง
3. สาขาแต่ละแห่งมีการตั้งค่า payment แยกกันได้
4. backend เลือก payment config ตาม branch ณ เวลาสร้าง payment
5. audit log เก็บว่าใครแก้ payment config เมื่อไร

---

## หลักการสถาปัตยกรรม

### แยก 3 ส่วนออกจากกัน

1. `Machine Entry`
- scan token ที่ตู้
- ยืนยันว่าธุรกรรมนี้เกิดจากเครื่องนี้จริง

2. `Payment Routing`
- เลือก payment configuration ตามสาขา
- ออก QR และ reference ให้ตรงปลายทางของสาขา

3. `Machine Execution`
- เมื่อ payment confirmed แล้วจึงส่ง command ไปเครื่อง

### ระบบกลางต้องเป็น source of truth

แม้แฟรนไชส์จะรับเงินเข้าบัญชีตัวเอง ระบบกลางยังต้องถือข้อมูลนี้:
- session ไหนถูกสร้างจาก scan ไหน
- payment ไหนผูกกับ session ไหน
- payment ของ branch ไหน
- provider/ref/reference อะไร
- machine ไหนถูกสั่งให้เริ่มจาก payment ไหน

---

## ภาพรวมการออกแบบ Payment สำหรับแฟรนไชส์

## โมเดลธุรกิจที่ควรรองรับ

### Mode A: HQ-managed payment

ใช้เมื่อ:
- HQ รับเงินแทนทุกสาขา
- หรือแฟรนไชส์ยังไม่พร้อมเปิด payment ของตัวเอง

### Mode B: Branch-owned payment

ใช้เมื่อ:
- สาขาแฟรนไชส์รับเงินเข้าบัญชีหรือ provider ของตัวเอง
- ระบบต้องออก QR ตาม config ของสาขานั้น

### Mode C: Manual branch payment

ใช้เป็นช่วงแรกได้:
- ใช้ PromptPay/manual QR ของสาขา
- ระบบยังมี payment record/reference/audit ครบ
- confirmation อาจมาจาก manual verification หรือ provider flow ภายหลัง

---

## Data Model ที่ควรเพิ่ม

### 1. BranchPaymentConfig

เก็บ config payment หลักของสาขา

ฟิลด์ที่ควรมี:

- `id`
- `branchId`
- `mode`
  - `hq_managed`
  - `branch_managed`
  - `manual_promptpay`
- `provider`
  - `promptpay_manual`
  - `opn`
  - `stripe`
  - `bank_qr`
  - `custom`
- `isActive`
- `displayName`
- `statementName`
- `settlementOwnerType`
  - `hq`
  - `franchisee`
- `createdAt`
- `updatedAt`

### 2. BranchPaymentCredential

เก็บ credential ที่ผูกกับ payment provider ของสาขา

ฟิลด์ที่ควรมี:

- `id`
- `branchPaymentConfigId`
- `key`
  - `promptpay_id`
  - `promptpay_name`
  - `api_key`
  - `merchant_id`
  - `secret`
  - `webhook_secret`
- `valueEncrypted`
- `maskedValue`
- `isSecret`
- `createdAt`
- `updatedAt`

หมายเหตุ:
- secret ไม่ควรเก็บ plain text
- อย่างน้อยควร encrypt ก่อนเก็บใน DB

### 3. BranchPaymentCapability

เก็บว่า config นี้ทำอะไรได้บ้าง

- `supportsWebhook`
- `supportsPolling`
- `supportsDynamicQr`
- `supportsReferenceBinding`
- `supportsRefund`
- `supportsSliplessConfirmation`

### 4. MachineScanToken

ใช้ตามแผน scan token

ฟิลด์ที่ควรมี:
- `id`
- `branchId`
- `machineId`
- `tokenHash`
- `nonce`
- `issuedAt`
- `expiresAt`
- `consumedAt`
- `consumedBySessionId`

### 5. เพิ่ม field ใน WashSession / Payment

ใน `WashSession`
- `scanTokenId`
- `paymentConfigId`
- `paymentRoutingMode`

ใน `Payment`
- `scanTokenId`
- `paymentConfigId`
- `providerPayload`
- `reference`
- `paymentQrType`
- `paymentConfirmedSource`

---

## หลังบ้านควรมี UX แบบไหน

### ระดับ HQ

HQ ต้องทำได้:
- เลือก default payment mode ของแต่ละสาขา
- อนุญาตหรือไม่อนุญาตให้แฟรนไชส์จัดการ payment เอง
- ดูสถานะว่า branch ไหนยัง setup payment ไม่ครบ
- force disable payment ของบางสาขาได้
- ดู audit log การแก้ payment config

### ระดับ Franchise / Branch Admin

แฟรนไชส์ต้องทำได้:
- ดูสถานะ payment setup ของสาขาตัวเอง
- เลือก payment mode ที่ HQ อนุญาต
- กรอก PromptPay ID / ชื่อรับเงิน / merchant id / api key ตาม provider
- ทดสอบ config เบื้องต้น
- เปิดใช้งาน config

### ข้อแนะนำ UX

หน้าใหม่ที่ควรมี:

1. `Branch Payment Setup`
- card สรุปสถานะ config
- provider ปัจจุบัน
- payment mode ปัจจุบัน
- readiness checklist

2. `Payment Destination Form`
- PromptPay ID
- PromptPay Name
- statement label
- provider credentials

3. `Verification Panel`
- test QR generation
- test webhook endpoint
- test payment inquiry

4. `Audit & History`
- ใครแก้อะไร
- เปิดใช้เมื่อไร
- ปิดใช้เมื่อไร

---

## สิทธิ์ที่ควรมี

### HQ Admin

- ดูทุกสาขา
- แก้ทุก payment config
- approve/reject branch payment setup

### Branch Admin (Franchise)

- ดูได้เฉพาะ branch scope ตัวเอง
- แก้เฉพาะ payment config ของ branch scope ตัวเอง
- ถ้า HQ lock config ไว้ ต้องแก้ไม่ได้

### Suggested permission flags

- `canManageBranchPayment`
- `canViewBranchPaymentAudit`
- `canActivateBranchPaymentConfig`

---

## Flow หลักที่ควรทำจริง

## Phase 1: Transaction-safe scan

เป้าหมาย:
- เปลี่ยนการสแกนธรรมดาให้เป็น signed token flow

งาน:
- เพิ่ม `MachineScanToken`
- ปรับ `/api/branches/resolve-scan`
- ผูก `scanTokenId` กับ session
- กัน replay

ผลลัพธ์:
- session ถูกผูกกับ scan transaction จริง

## Phase 2: Branch-specific payment routing

เป้าหมาย:
- payment ของแต่ละสาขาใช้ปลายทางของตัวเอง

งาน:
- เพิ่ม `BranchPaymentConfig`
- เพิ่ม `BranchPaymentCredential`
- payment creation เลือก config ตาม branch
- รองรับ `manual_promptpay` ก่อน

ผลลัพธ์:
- สาขาแฟรนไชส์รับเงินเข้าปลายทางของตัวเองได้

## Phase 3: Admin payment setup UI

เป้าหมาย:
- ให้ branch admin/hq setup payment เองในหลังบ้าน

งาน:
- เพิ่มหน้า `Branch Payment Setup`
- เพิ่ม form setup
- เพิ่ม activate/deactivate
- เพิ่ม readiness state

ผลลัพธ์:
- แฟรนไชส์ setup payment เองได้โดยไม่แก้ env

## Phase 4: Payment confirmation hardening

เป้าหมาย:
- ลูกค้าไม่ต้องอัปโหลดสลิป

งาน:
- ถ้าใช้ provider จริง: webhook/inquiry
- ถ้าใช้ manual promptpay: reference-driven verification path
- mark `ready_to_wash` เมื่อ confirm เท่านั้น

ผลลัพธ์:
- payment flow ปลดเครื่องได้เฉพาะรายการที่จ่ายจริง

## Phase 5: Machine execution hardening

เป้าหมาย:
- command ไปเครื่องต้องผูกกับ session/payment จริง

งาน:
- ส่ง `sessionId/paymentId/reference` ไปกับ MQTT
- ให้ machine events สะท้อน session เดิมกลับมา
- เพิ่ม audit chain

ผลลัพธ์:
- trace ได้ครบตั้งแต่ scan ถึงเครื่องเริ่มทำงาน

---

## Task Breakdown สำหรับคุยต่อกับแชทอื่น

## Task 1: Scan Token Backend Foundation

เป้าหมาย:
- เพิ่ม model และ service สำหรับ signed scan token

ขอบเขต:
- prisma schema
- migration
- token signing/verifying service
- `/api/branches/resolve-scan`

Definition of done:
- scan token มี expiry + nonce + anti-replay
- resolve-scan รองรับ signed token

## Task 2: Session Binding กับ Scan Token

เป้าหมาย:
- session ต้องสร้างจาก scan token ที่ valid เท่านั้น

ขอบเขต:
- ปรับ `POST /api/sessions`
- consume token ตอนสร้าง session
- ป้องกันสร้าง session ซ้ำจาก token เดิม

Definition of done:
- ทุก session มี scan context ที่ตรวจสอบย้อนหลังได้

## Task 3: Branch Payment Config Data Model

เป้าหมาย:
- รองรับ payment config รายสาขา

ขอบเขต:
- เพิ่ม models `BranchPaymentConfig`, `BranchPaymentCredential`
- seed/default data
- mapping utilities

Definition of done:
- branch มี payment config ของตัวเองได้

## Task 4: Payment Routing Engine

เป้าหมาย:
- payment creation เลือก provider/config ตาม branch

ขอบเขต:
- ปรับ `createPaymentForSession`
- map `branch -> paymentConfig`
- รองรับ `manual_promptpay` ก่อน

Definition of done:
- payment record อ้างถึง payment config ที่ใช้จริง

## Task 5: Admin Franchise Payment Setup UI

เป้าหมาย:
- ให้เจ้าของแฟรนไชส์ setup payment ของตัวเองในหลังบ้านได้

ขอบเขต:
- หน้าใหม่ใน admin dashboard
- list + form + status + activate/deactivate
- scope/permission

Definition of done:
- branch admin setup payment ของ branch scope ตัวเองได้

## Task 6: HQ Governance UI

เป้าหมาย:
- HQ คุมว่า branch ไหนใช้ payment mode อะไรได้

ขอบเขต:
- approve/lock config
- readiness overview
- audit log

Definition of done:
- HQ เห็นสถานะ setup ทุกสาขา

## Task 7: Payment QR + Reference Refactor

เป้าหมาย:
- ทุก payment มี QR และ reference ต่อ session

ขอบเขต:
- payment reference generation
- QR payload generation
- save provider payload

Definition of done:
- payment QR ถูกสร้างจาก config ของ branch และผูกกับ session จริง

## Task 8: Machine Command Hardening

เป้าหมาย:
- machine start ต้องผูกกับ payment confirmed session เท่านั้น

ขอบเขต:
- start wash guards
- MQTT payload enrichment
- machine event correlation

Definition of done:
- machine command trace ได้ถึง payment/session

---

## Prompt Template สำหรับคุยต่อกับแชทอื่น

```text
โปรเจกต์อยู่ที่ C:\Users\PC\Downloads\roboare\robossoneman

ช่วยทำ <TASK NAME> ของระบบ ROBOSS ต่อจากแผนใน docs/scan-token-payment-flow.md และ docs/franchise-payment-setup-roadmap.md

บริบท:
- ระบบลูกค้า/หลังบ้าน/Render/Vercel ขึ้น staging แล้ว
- มี Clerk + LINE login แล้ว
- payment flow ปัจจุบันยังเป็นโครงชั่วคราว
- เป้าหมายใหม่คือ scan token + session-specific payment QR + branch payment config
- อย่าเปลี่ยน customer UX/UI หลักถ้าไม่จำเป็น

งานที่ต้องทำ:
1. อ่าน docs/scan-token-payment-flow.md
2. อ่าน docs/franchise-payment-setup-roadmap.md
3. อ่าน codebase ที่เกี่ยวข้องก่อนลงมือ
4. ทำเฉพาะ task นี้ให้จบ end-to-end
5. รัน build/typecheck เท่าที่ทำได้

สิ่งที่ต้องการในผลลัพธ์:
- แก้โค้ดจริง
- สรุปสิ่งที่เปลี่ยน
- definition of done
- blocker ที่ยังเหลือ
```

---

## คำแนะนำการเริ่มลงมือ

ถ้าจะเริ่มทำจริงตอนนี้ ลำดับที่คุ้มสุดคือ:

1. `Task 1: Scan Token Backend Foundation`
2. `Task 2: Session Binding กับ Scan Token`
3. `Task 3: Branch Payment Config Data Model`
4. `Task 5: Admin Franchise Payment Setup UI`
5. `Task 4: Payment Routing Engine`

เหตุผล:
- ต้องล็อก transaction-safe scan ก่อน
- แล้วค่อยสร้าง branch-specific payment บนฐานข้อมูลที่รองรับแล้ว
