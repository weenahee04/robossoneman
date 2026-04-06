# ROBOSS Scan Token + Payment QR Flow

เอกสารนี้สรุป flow ที่เหมาะกับ ROBOSS สำหรับการเริ่มล้างรถจาก QR ที่ตู้ โดยไม่ใช้การอัปโหลดสลิป และล็อกธุรกรรมให้ผูกกับการสแกนครั้งนั้นเท่านั้น

## เป้าหมาย

- QR ที่ตู้ใช้เพื่อระบุ `branch + machine + scan transaction`
- ธุรกรรมต้องผูกกับ `timestamp + nonce + expiry + signature`
- ลูกค้าจ่ายผ่าน `payment QR` ที่สร้างใหม่ต่อ session
- ชำระเงินสำเร็จแล้วจึงปลด `ready_to_wash`
- เริ่มเครื่องได้เฉพาะ `session` ที่จ่ายแล้วและผูกกับ scan token เดิม

## หลักการแยก QR ออกเป็น 2 ชนิด

### 1. Machine Scan QR

ติดอยู่ที่เครื่อง ใช้เพื่อเริ่ม flow เท่านั้น

หน้าที่:
- ระบุเครื่องและสาขา
- ยืนยันว่าการเริ่มรายการนี้มาจากตู้จริง
- จำกัดอายุการใช้งานสั้น
- กัน reuse/replay

### 2. Payment QR

สร้างใหม่ทุกครั้งหลังลูกค้าเลือกแพ็กเกจ

หน้าที่:
- รับเงินสำหรับ `payment` รายการนั้น
- ผูกกับ `sessionId / paymentId / reference / amount`
- ใช้ยืนยันการชำระเงินจริง

## Flow หลัก

1. ลูกค้าสแกน QR ที่ตู้
2. frontend ส่ง token ไป `POST /api/branches/resolve-scan`
3. backend verify token:
   - signature ถูกต้อง
   - ยังไม่หมดอายุ
   - nonce ยังไม่ถูกใช้
   - machine ใช้งานได้
4. backend คืน machine context กลับมา
5. ลูกค้าเลือกแพ็กเกจ
6. backend สร้าง `WashSession`
7. backend สร้าง `Payment`
8. backend สร้าง `reference` และ `payment QR`
9. ลูกค้าจ่ายเงิน
10. backend ได้ payment confirmation หรือ reconcile สำเร็จ
11. session เปลี่ยนเป็น `ready_to_wash`
12. ลูกค้ากดยืนยันเริ่มล้าง
13. backend publish MQTT command ไปที่เครื่อง
14. ESP/PLC สั่ง relay หรือ contactor
15. เครื่องส่ง event กลับ:
   - `washing_started`
   - `progress_updated`
   - `completed`

## รูปแบบ Machine Scan Token

แนะนำให้เป็น signed token ไม่ใช่ plain text

ตัวอย่าง payload ก่อน sign:

```json
{
  "v": 1,
  "branchId": "branch_c02",
  "machineId": "branch_c02_car_01",
  "machineCode": "A1",
  "issuedAt": 1775289000,
  "expiresAt": 1775289300,
  "nonce": "7f2e9f5d5c9c4c0f8d7a9c9d",
  "deviceHint": "ESP32-RAMA9-A1"
}
```

จากนั้น sign ด้วย server secret แล้ว encode เป็น token เดียว เช่น:

```text
roboss://scan?token=<signed-token>
```

หรือ URL ตรงเข้าพอร์ทัล:

```text
https://portal.roboss.co.th/carwash?scanToken=<signed-token>
```

## อายุ token

แนะนำ:
- อายุ 3-5 นาที
- ใช้ได้ครั้งเดียว
- ถ้ามีการสร้าง session/payment แล้ว ให้ถือว่า token ถูก consume

## กฎกัน replay

ต้องมีทั้ง 3 ชั้น:

1. `expiresAt`
2. `nonce`
3. `usedAt / consumedBySessionId`

ถ้า token เดียวถูกส่งซ้ำ:
- ถ้ายังไม่ถูก consume และยังไม่หมดอายุ อาจคืน context เดิมได้
- ถ้าถูก consume แล้ว ให้ปฏิเสธหรือคืน session เดิมแบบ read-only

## โครงสร้างฐานข้อมูลที่ควรเพิ่ม

### Table: `machine_scan_tokens`

เก็บสถานะ token ที่ backend ออกหรือรู้จัก

ฟิลด์ที่ควรมี:

- `id`
- `tokenHash`
- `branchId`
- `machineId`
- `issuedAt`
- `expiresAt`
- `nonce`
- `consumedAt`
- `consumedBySessionId`
- `createdAt`

หมายเหตุ:
- ไม่ควรเก็บ token ดิบทั้งก้อน
- เก็บ hash ของ token หรือ hash ของ nonce+signature จะปลอดภัยกว่า

### เพิ่มใน `WashSession`

ฟิลด์ที่ควรเพิ่ม:

- `scanTokenId`
- `scanNonce`
- `scanIssuedAt`
- `scanExpiresAt`
- `scanSource`

### เพิ่มใน `Payment`

ฟิลด์ที่ควรเพิ่ม:

- `scanTokenId`
- `paymentQrType`
- `paymentIntentIssuedAt`
- `paymentConfirmedSource`

## Endpoint ที่ควรเพิ่มหรือปรับ

### 1. `POST /api/branches/resolve-scan`

ปัจจุบันมีแล้ว แต่ควรขยายจาก plain QR data ไปเป็น signed token flow

request:

```json
{
  "scanToken": "<signed-token>"
}
```

response:

```json
{
  "data": {
    "branch": { "...": "..." },
    "machine": { "...": "..." },
    "scan": {
      "tokenId": "mst_001",
      "expiresAt": "2026-04-04T08:15:00.000Z",
      "nonce": "7f2e..."
    }
  }
}
```

### 2. `POST /api/sessions`

ปัจจุบันมีแล้ว ควรเพิ่ม input:

```json
{
  "branchId": "...",
  "machineId": "...",
  "packageId": "...",
  "carSize": "M",
  "addons": [],
  "couponId": "...",
  "scanTokenId": "mst_001"
}
```

สิ่งที่ backend ต้องตรวจ:
- scan token ยัง valid
- machine ตรงกับ token
- token ยังไม่ถูก consume

เมื่อสร้าง session สำเร็จ:
- mark token เป็น consumed
- ผูก `consumedBySessionId`

### 3. `POST /api/payments`

ปัจจุบันมีแล้ว ควรเพิ่ม logic:
- create unique `reference`
- create payment QR สำหรับรายการนั้น
- ผูก payment เข้ากับ session เดิม

reference ควร derive จาก:
- branch code
- machine code
- session short id
- timestamp หรือ random suffix

ตัวอย่าง:

```text
RB-C02-A1-240404-8F2K
```

## Payment QR ที่แนะนำ

### ระยะเริ่มต้น

ใช้ session-specific PromptPay QR โดยมี:
- recipient ของสาขา
- amount
- reference/order note ถ้าช่องทางรองรับ

### ระยะโต

เปลี่ยนเป็น provider/bank API ที่มี:
- create QR ต่อ order
- confirm payment / inquiry
- webhook

## กฎการปลด `ready_to_wash`

ต้องครบทั้งนี้:

1. session ยังไม่หมดอายุ
2. payment status = `confirmed`
3. machine ยังพร้อม
4. scan token ของ session นี้ valid และ machine ตรงกัน

## กฎการเริ่มเครื่อง

เมื่อกด `start wash`

backend ต้องเช็ก:
- session.status = `ready_to_wash`
- payment.status = `confirmed`
- machine.status อยู่ในสถานะพร้อมเริ่ม
- scan token ของ session นี้ไม่ mismatch กับ machine ปัจจุบัน

จากนั้นค่อย:
- publish MQTT command `start`

## MQTT command ที่ใช้ได้กับ flow นี้

topic:

```text
roboss/{branchId}/{espDeviceId}/command
```

payload:

```json
{
  "command": "start",
  "sessionId": "sess_123",
  "paymentId": "pay_123",
  "reference": "RB-C02-A1-240404-8F2K",
  "timestamp": 1775289000
}
```

## ฝั่ง ESP / PLC / Relay

แนะนำให้ ESP ทำแค่ control signal layer

เมื่อได้ `start`:
- validate payload ขั้นพื้นฐาน
- trigger relay/contactor
- publish `washing_started`

ระหว่างทำงาน:
- publish `progress_updated`

จบงาน:
- publish `completed`

### สำคัญ

อย่าใช้ relay module ตัวเล็กไปสั่งโหลดมอเตอร์ไฟบ้านโดยตรง

ควรใช้:
- relay แบบ isolated สำหรับ dry contact
- หรือไปคุมคอยล์ contactor / PLC input

## Business Rules ที่ควรใช้

- scan token หมดอายุใน 5 นาที
- session ต้องเริ่มภายใน grace time
- payment QR หมดอายุใน 5-15 นาที
- token หนึ่งใช้ได้กับหนึ่ง session เท่านั้น
- session หนึ่งมี payment หลักได้หนึ่งรายการ
- ถ้า payment หมดอายุ ให้สร้าง payment ใหม่ได้ แต่ยังผูก session เดิม

## ลำดับ implementation ที่แนะนำ

### Phase 1

- เพิ่ม scan token model
- เปลี่ยน `/resolve-scan` ให้รองรับ signed token
- ผูก `scanTokenId` เข้ากับ `WashSession`
- ทำ consume-on-session-create

### Phase 2

- generate payment reference ต่อ session
- generate payment QR ต่อ session
- แสดง payment QR ใน customer flow

### Phase 3

- ปรับ `start wash` ให้เช็ก token/session/payment ครบ
- ส่ง `sessionId/paymentId/reference` ไปกับ MQTT command

### Phase 4

- เพิ่ม audit trail:
  - scan created
  - scan resolved
  - session created from scan
  - payment created
  - payment confirmed
  - machine started

## ข้อสรุป

flow ที่คุณต้องการทำได้ และเป็นแนวที่ควรใช้สำหรับ ROBOSS:

- สแกนที่ตู้ = สร้างสิทธิ์เข้า flow แบบมีอายุ
- เลือกแพ็กเกจ = สร้าง session
- backend = gen payment QR + reference ต่อรายการ
- จ่ายสำเร็จ = ปลดให้เริ่มล้าง
- เริ่มเครื่อง = ได้เฉพาะธุรกรรมนั้นเท่านั้น

เอกสารนี้ตั้งใจให้ใช้เป็น blueprint สำหรับรอบ implementation ถัดไป
