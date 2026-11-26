import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptBranchPaymentCredential, maskCredentialValue } from '../src/services/branch-payment-config.js';

const prisma = new PrismaClient();

type BranchSeed = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  type: string;
  ownershipType: 'company_owned' | 'franchise';
  franchiseCode?: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  hours: string;
  promptPayId: string;
  promptPayName: string;
  ownerName?: string;
  mapsUrl: string;
  supportPhone: string;
  pointsEarnRate?: number;
};

const packages = [
  {
    id: 'pkg_quick',
    code: 'QUICK',
    name: 'QUICK & CLEAN',
    description: 'ล้างภายนอกแบบรวดเร็วสำหรับรถยนต์',
    vehicleType: 'car',
    priceS: 1,
    priceM: 1,
    priceL: 1,
    steps: ['ฉีดน้ำแรงดันสูง', 'โฟมล้างรถ', 'แปรงอัตโนมัติ', 'เป่าแห้ง'],
    stepDuration: 300,
    image: '/freepik_0001.png',
    sortOrder: 1,
  },
  {
    id: 'pkg_shine',
    code: 'SHINE',
    name: 'SHINE MODE',
    description: 'ล้างพร้อมเคลือบเงา',
    vehicleType: 'car',
    priceS: 139,
    priceM: 149,
    priceL: 169,
    steps: ['ฉีดน้ำแรงดันสูง', 'โฟมล้างรถ', 'แปรงอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงา'],
    stepDuration: 300,
    image: '/freepik_0001_(1).png',
    sortOrder: 2,
  },
  {
    id: 'pkg_special',
    code: 'SPECIAL',
    name: 'SPECIAL MODE',
    description: 'แพ็กเกจดูแลรถแบบลึกและเคลือบเงา',
    vehicleType: 'car',
    priceS: 339,
    priceM: 399,
    priceL: 469,
    steps: ['ฉีดน้ำแรงดันสูง', 'โฟมล้างรถ', 'แปรงอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงาพิเศษ'],
    stepDuration: 300,
    image: '/freepik_0001_(2).png',
    sortOrder: 3,
  },
  {
    id: 'pkg_vacuum',
    code: 'VACUUM',
    name: 'ดูดฝุ่นภายใน',
    description: 'บริการดูดฝุ่นภายในรถยนต์',
    vehicleType: 'car',
    priceS: 70,
    priceM: 90,
    priceL: 120,
    steps: ['ดูดฝุ่นภายใน'],
    stepDuration: 300,
    image: '/freepik_0001_(3).png',
    sortOrder: 4,
  },
  // ── Motorcycle packages — real ROBOSS pricing: base wash 49฿, 1-3 min,
  //    touchless (source: Roboss official TikTok/Facebook). Flat price, no S/M/L.
  //    stepDuration 60s/step ≈ 1-3 min total, matching the real machine.
  {
    id: 'pkg_moto_quick',
    code: 'MOTO_QUICK',
    name: 'MOTO QUICK 49',
    description: 'ล้างมอเตอร์ไซค์อัตโนมัติ ไร้สัมผัส เสร็จใน 1-3 นาที',
    vehicleType: 'motorcycle',
    priceS: 49,
    priceM: 49,
    priceL: 49,
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'เป่าแห้ง'],
    stepDuration: 60,
    sortOrder: 5,
  },
  {
    id: 'pkg_moto_shine',
    code: 'MOTO_SHINE',
    name: 'MOTO SHINE 69',
    description: 'ล้างมอเตอร์ไซค์พร้อมเคลือบเงา ปกป้องสีรถ',
    vehicleType: 'motorcycle',
    priceS: 69,
    priceM: 69,
    priceL: 69,
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'เป่าแห้ง', 'เคลือบเงา'],
    stepDuration: 60,
    sortOrder: 6,
  },
  {
    id: 'pkg_moto_premium',
    code: 'MOTO_PREMIUM',
    name: 'MOTO PREMIUM 99',
    description: 'โฟมหนาพิเศษ + เคลือบเงา ดูแลครบสำหรับบิ๊กไบค์และรถที่รักเป็นพิเศษ',
    vehicleType: 'motorcycle',
    priceS: 99,
    priceM: 99,
    priceL: 99,
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงา'],
    stepDuration: 60,
    sortOrder: 7,
  },
];

// Full ROBOSS branch network — 17 car + 17 motorcycle (separate branches).
// status 'soon' = อยู่ระหว่างดำเนินการ (shown on map, no active service yet).
type RawBranch = {
  id: string;
  code: string;
  type: 'car' | 'motorcycle';
  name: string;
  short: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  own: 'company_owned' | 'franchise';
  soon?: boolean;
};

const RAW_BRANCHES: RawBranch[] = [
  // ===================== ล้างรถยนต์ (car) =====================
  { id: 'branch_c01', code: 'CAR_RAMA9', type: 'car', name: 'ROBOSS ล้างรถ พระราม 9', short: 'พระราม 9', area: 'กรุงเทพมหานคร', address: 'ซ.โรงพยาบาลพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร', lat: 13.7571, lng: 100.569, own: 'company_owned' },
  { id: 'branch_c02', code: 'CAR_RAMINTRA109', type: 'car', name: 'ROBOSS ล้างรถ รามอินทรา 109', short: 'รามอินทรา 109', area: 'กรุงเทพมหานคร', address: 'ถ.พระยาสุเรนทร์ ซ.พระยาสุเรนทร์ 23 เขตคันนายาว กรุงเทพมหานคร', lat: 13.8303, lng: 100.7102, own: 'company_owned' },
  { id: 'branch_c03', code: 'CAR_KRUNGTHEPKREETHA', type: 'car', name: 'ROBOSS ล้างรถ กรุงเทพกรีฑา', short: 'กรุงเทพกรีฑา', area: 'กรุงเทพมหานคร', address: 'ถ.กรุงเทพกรีฑา เขตสะพานสูง กรุงเทพมหานคร', lat: 13.746, lng: 100.679, own: 'company_owned', soon: true },
  { id: 'branch_c04', code: 'CAR_EKKACHAI', type: 'car', name: 'ROBOSS ล้างรถ เอกชัย', short: 'เอกชัย', area: 'กรุงเทพมหานคร', address: 'ถ.เอกชัย เขตบางบอน กรุงเทพมหานคร', lat: 13.669, lng: 100.418, own: 'franchise' },
  { id: 'branch_c05', code: 'CAR_BANGKHAE', type: 'car', name: 'ROBOSS ล้างรถ บางแค-กาญจนาภิเษก', short: 'บางแค', area: 'กรุงเทพมหานคร', address: 'ถ.กาญจนาภิเษก เขตบางแค กรุงเทพมหานคร', lat: 13.696, lng: 100.409, own: 'franchise', soon: true },
  { id: 'branch_c06', code: 'CAR_PATHUMTHANI', type: 'car', name: 'ROBOSS ล้างรถ ปทุมธานี', short: 'ปทุมธานี', area: 'ปทุมธานี', address: 'ถ.ปทุม-ลาดหลุมแก้ว อ.ลาดหลุมแก้ว จ.ปทุมธานี', lat: 14.033, lng: 100.429, own: 'franchise' },
  { id: 'branch_c07', code: 'CAR_LOPBURI', type: 'car', name: 'ROBOSS ล้างรถ ลพบุรี', short: 'ลพบุรี', area: 'ลพบุรี', address: 'อ.เมืองลพบุรี จ.ลพบุรี', lat: 14.7995, lng: 100.6534, own: 'franchise', soon: true },
  { id: 'branch_c08', code: 'CAR_RAYONG', type: 'car', name: 'ROBOSS ล้างรถ ระยอง', short: 'ระยอง', area: 'ระยอง', address: 'อ.นิคมพัฒนา ก่อนถึงแยกนิคมพัฒนา จ.ระยอง', lat: 12.952, lng: 101.145, own: 'franchise' },
  { id: 'branch_c09', code: 'CAR_NAKHONSAWAN', type: 'car', name: 'ROBOSS ล้างรถ นครสวรรค์', short: 'นครสวรรค์', area: 'นครสวรรค์', address: 'อ.เมืองนครสวรรค์ จ.นครสวรรค์', lat: 15.7047, lng: 100.1372, own: 'franchise', soon: true },
  { id: 'branch_c10', code: 'CAR_LAMPANG', type: 'car', name: 'ROBOSS ล้างรถ ลำปาง', short: 'ลำปาง', area: 'ลำปาง', address: 'อ.เมืองลำปาง ข้างห้าง Makro (Jook Club) จ.ลำปาง', lat: 18.286, lng: 99.501, own: 'franchise' },
  { id: 'branch_c11', code: 'CAR_UTHAITHANI', type: 'car', name: 'ROBOSS ล้างรถ อุทัยธานี', short: 'อุทัยธานี', area: 'อุทัยธานี', address: 'อ.หนองฉาง ข้างโรงเรียนหนองฉาง จ.อุทัยธานี', lat: 15.362, lng: 99.896, own: 'franchise' },
  { id: 'branch_c12', code: 'CAR_ROIET', type: 'car', name: 'ROBOSS ล้างรถ ร้อยเอ็ด', short: 'ร้อยเอ็ด', area: 'ร้อยเอ็ด', address: 'อ.เมืองร้อยเอ็ด จ.ร้อยเอ็ด', lat: 16.0538, lng: 103.652, own: 'franchise', soon: true },
  { id: 'branch_c13', code: 'CAR_KHONKAEN', type: 'car', name: 'ROBOSS ล้างรถ ขอนแก่น', short: 'ขอนแก่น', area: 'ขอนแก่น', address: 'อ.เมืองขอนแก่น จ.ขอนแก่น', lat: 16.4419, lng: 102.836, own: 'franchise', soon: true },
  { id: 'branch_c14', code: 'CAR_NST_OMKAI', type: 'car', name: 'ROBOSS ล้างรถ นครศรีฯ (อ้อมค่าย)', short: 'นครศรีฯ อ้อมค่าย', area: 'นครศรีธรรมราช', address: 'ถ.อ้อมค่าย ติดปั๊ม ปตท.อ้อมค่าย อ.เมือง จ.นครศรีธรรมราช', lat: 8.42, lng: 99.97, own: 'franchise' },
  { id: 'branch_c15', code: 'CAR_NST_PAKPHANANG', type: 'car', name: 'ROBOSS ล้างรถ นครศรีฯ (ปากพนัง)', short: 'นครศรีฯ ปากพนัง', area: 'นครศรีธรรมราช', address: 'ปากพนัง ใกล้โฮมโปรนคร อ.เมือง จ.นครศรีธรรมราช', lat: 8.35, lng: 100.2, own: 'franchise' },
  { id: 'branch_c16', code: 'CAR_PHUKET_SAMKONG', type: 'car', name: 'ROBOSS ล้างรถ ภูเก็ต (สามกอง)', short: 'ภูเก็ต สามกอง', area: 'ภูเก็ต', address: 'ถ.สามกอง อ.เมืองภูเก็ต จ.ภูเก็ต', lat: 7.8992, lng: 98.3761, own: 'franchise' },
  { id: 'branch_c17', code: 'CAR_SATUN', type: 'car', name: 'ROBOSS ล้างรถ สตูล', short: 'สตูล', area: 'สตูล', address: 'อ.ฉลุง ตรงข้ามไปรษณีย์ฉลุง จ.สตูล', lat: 6.7254, lng: 100.0669, own: 'franchise' },

  // ===================== ล้างมอเตอร์ไซค์ (motorcycle) =====================
  { id: 'branch_b01', code: 'MOTO_RAMA9', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ พระราม 9', short: 'มอไซค์ พระราม 9', area: 'กรุงเทพมหานคร', address: 'ซ.โรงพยาบาลพระราม 9 แขวงห้วยขวาง กรุงเทพมหานคร', lat: 13.7571, lng: 100.569, own: 'company_owned' },
  { id: 'branch_b02', code: 'MOTO_KRUNGTHEPKREETHA', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ กรุงเทพกรีฑา', short: 'มอไซค์ กรุงเทพกรีฑา', area: 'กรุงเทพมหานคร', address: 'ถ.กรุงเทพกรีฑา เขตสะพานสูง กรุงเทพมหานคร', lat: 13.7455, lng: 100.6795, own: 'company_owned', soon: true },
  { id: 'branch_b03', code: 'MOTO_EKKACHAI', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ เอกชัย', short: 'มอไซค์ เอกชัย', area: 'กรุงเทพมหานคร', address: 'ถ.เอกชัย เขตบางบอน กรุงเทพมหานคร', lat: 13.6685, lng: 100.4185, own: 'franchise' },
  { id: 'branch_b04', code: 'MOTO_BANGKHAE', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ บางแค-กาญจนาภิเษก', short: 'มอไซค์ บางแค', area: 'กรุงเทพมหานคร', address: 'ถ.กาญจนาภิเษก เขตบางแค กรุงเทพมหานคร', lat: 13.6955, lng: 100.4085, own: 'franchise', soon: true },
  { id: 'branch_b05', code: 'MOTO_THAPHRA', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ ท่าพระ', short: 'มอไซค์ ท่าพระ', area: 'กรุงเทพมหานคร', address: 'ซ.เทอดไท 33 แขวงดาวคะนอง เขตธนบุรี กรุงเทพมหานคร', lat: 13.7159, lng: 100.4762, own: 'franchise' },
  { id: 'branch_b06', code: 'MOTO_RAMA4', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ พระราม 4', short: 'มอไซค์ พระราม 4', area: 'กรุงเทพมหานคร', address: 'ปั๊ม ปตท.พระราม 4-กล้วยน้ำไท กรุงเทพมหานคร', lat: 13.716, lng: 100.5746, own: 'company_owned' },
  { id: 'branch_b07', code: 'MOTO_DONMUANG', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ ดอนเมือง', short: 'มอไซค์ ดอนเมือง', area: 'กรุงเทพมหานคร', address: 'ปั๊มบางจาก โกสุมรวมใจ เขตดอนเมือง กรุงเทพมหานคร', lat: 13.92, lng: 100.6, own: 'company_owned' },
  { id: 'branch_b08', code: 'MOTO_UDOMSUK', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ อุดมสุข', short: 'มอไซค์ อุดมสุข', area: 'กรุงเทพมหานคร', address: 'ปั๊มบางจาก อุดมสุข เขตบางนา กรุงเทพมหานคร', lat: 13.67, lng: 100.61, own: 'company_owned' },
  { id: 'branch_b09', code: 'MOTO_YAMAHA', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ Yamaha ประเทศไทย', short: 'Yamaha คลังสินค้า', area: 'สมุทรปราการ', address: 'Yamaha ประเทศไทย (คลังสินค้า)', lat: 13.6, lng: 100.6, own: 'company_owned' },
  { id: 'branch_b10', code: 'MOTO_CHONBURI', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ ชลบุรี', short: 'มอไซค์ ชลบุรี', area: 'ชลบุรี', address: 'หนองไม้แดง ซ.วัดอู่ตะเภา อ.เมืองชลบุรี จ.ชลบุรี', lat: 13.372, lng: 101.005, own: 'franchise' },
  { id: 'branch_b11', code: 'MOTO_MAESOT', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ แม่สอด', short: 'มอไซค์ แม่สอด', area: 'ตาก', address: 'ปั๊มบางจาก แม่ปะ อ.แม่สอด จ.ตาก', lat: 16.7511, lng: 98.5721, own: 'franchise' },
  { id: 'branch_b12', code: 'MOTO_NAKHONSAWAN', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ นครสวรรค์', short: 'มอไซค์ นครสวรรค์', area: 'นครสวรรค์', address: 'อ.เมืองนครสวรรค์ จ.นครสวรรค์', lat: 15.7047, lng: 100.1372, own: 'franchise', soon: true },
  { id: 'branch_b13', code: 'MOTO_YASOTHON', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ ยโสธร', short: 'มอไซค์ ยโสธร', area: 'ยโสธร', address: 'ต.สำราญ อ.เมือง ข้าง TOFFEE CAFE จ.ยโสธร', lat: 15.79, lng: 104.13, own: 'franchise' },
  { id: 'branch_b14', code: 'MOTO_NST', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ นครศรีธรรมราช', short: 'มอไซค์ นครศรีฯ', area: 'นครศรีธรรมราช', address: 'ใกล้โฮมโปรนคร อ.เมือง จ.นครศรีธรรมราช', lat: 8.4304, lng: 99.9631, own: 'franchise' },
  { id: 'branch_b15', code: 'MOTO_SONGKHLA', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ สงขลา', short: 'มอไซค์ สงขลา', area: 'สงขลา', address: 'อ.เมืองสงขลา จ.สงขลา', lat: 7.19, lng: 100.595, own: 'franchise' },
  { id: 'branch_b16', code: 'MOTO_PHUKET_SAMKONG', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ ภูเก็ต (สามกอง)', short: 'มอไซค์ ภูเก็ต สามกอง', area: 'ภูเก็ต', address: 'ถ.สามกอง อ.เมืองภูเก็ต จ.ภูเก็ต', lat: 7.8992, lng: 98.3761, own: 'franchise' },
  { id: 'branch_b17', code: 'MOTO_PHUKET_BANGTAO', type: 'motorcycle', name: 'ROBOSS ล้างมอไซค์ ภูเก็ต (บางเทา)', short: 'มอไซค์ ภูเก็ต บางเทา', area: 'ภูเก็ต', address: 'บางเทา ซ.4 อ.ถลาง จ.ภูเก็ต', lat: 7.995, lng: 98.296, own: 'franchise' },
];

const branches: BranchSeed[] = RAW_BRANCHES.map((b, index) => ({
  id: b.id,
  code: b.code,
  name: b.name,
  shortName: b.short,
  type: b.type,
  ownershipType: b.own,
  franchiseCode: b.own === 'franchise' ? `F-${b.code}` : undefined,
  address: b.address,
  area: b.area,
  lat: b.lat,
  lng: b.lng,
  hours: b.soon ? 'เร็วๆ นี้' : '06:00 - 22:00',
  promptPayId: `09${String(11000000 + index).slice(-8)}`,
  promptPayName: b.name,
  ownerName: b.own === 'company_owned' ? 'ROBOSS HQ' : `${b.short} Franchise`,
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`,
  supportPhone: '02-000-0000',
  pointsEarnRate: 10,
}));

const branchPackageOverrides: Record<string, Partial<Record<string, { S?: number; M?: number; L?: number; isVisible?: boolean }>>> = {
  branch_c01: {
    pkg_special: { S: 329, M: 389, L: 459 },
  },
  branch_c02: {
    pkg_quick: { S: 109, M: 119, L: 139 },
  },
  branch_c04: {
    pkg_shine: { S: 149, M: 159, L: 179 },
    pkg_special: { S: 359, M: 419, L: 489 },
  },
  branch_b01: {
    pkg_moto_quick: { S: 39, M: 49, L: 59 },
  },
};

const coupons = [
  {
    id: 'coupon_welcome_all',
    code: 'WELCOME50',
    title: 'สมาชิกใหม่ลด 50%',
    description: 'ใช้ได้ครั้งแรกทุกสาขา',
    scope: 'all_branches' as const,
    discountType: 'percent' as const,
    discountValue: 50,
    minSpend: 0,
    maxUses: 1000,
    maxUsesPerUser: 1,
    isPurchasable: false,
    purchasePrice: 0,
    packageIds: [] as string[],
    branchIds: [] as string[],
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2026-12-31'),
  },
  {
    id: 'coupon_ram109_local',
    code: 'RAM109NEW',
    title: 'รามอินทรา 109 ลด 40%',
    description: 'เฉพาะสาขารามอินทรา 109',
    scope: 'branch_only' as const,
    discountType: 'percent' as const,
    discountValue: 40,
    minSpend: 150,
    maxUses: 300,
    maxUsesPerUser: 1,
    isPurchasable: false,
    purchasePrice: 0,
    packageIds: ['pkg_quick', 'pkg_shine'],
    branchIds: ['branch_c01'],
    validFrom: new Date('2025-06-01'),
    validUntil: new Date('2026-12-31'),
  },
  {
    id: 'coupon_east_combo',
    code: 'EAST30',
    title: 'ฝั่งตะวันออกลด 30 บาท',
    description: 'ใช้ได้เฉพาะชลบุรีและสาขาที่เลือก',
    scope: 'selected_branches' as const,
    discountType: 'fixed' as const,
    discountValue: 30,
    minSpend: 99,
    maxUses: 500,
    maxUsesPerUser: 2,
    isPurchasable: false,
    purchasePrice: 0,
    packageIds: [],
    branchIds: ['branch_c04', 'branch_b01'],
    validFrom: new Date('2025-06-01'),
    validUntil: new Date('2026-12-31'),
  },
  {
    id: 'coupon_graphene_paid_99',
    code: 'GRAPHENE99',
    title: 'Graphene Upgrade Coupon',
    description: 'Buy by bank transfer, then use for Graphene add-on discount.',
    scope: 'selected_branches' as const,
    discountType: 'fixed' as const,
    discountValue: 99,
    minSpend: 199,
    maxUses: 300,
    maxUsesPerUser: 1,
    isPurchasable: true,
    purchasePrice: 49,
    packageIds: [] as string[],
    branchIds: ['branch_c01', 'branch_c02', 'branch_c04'],
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
  },
];

const promotions = [
  {
    id: 'promo_summer',
    title: 'โปรหน้าร้อน ลด 20%',
    description: 'ล้างรถทุกสาขาลด 20%',
    branchIds: [],
    gradient: 'from-red-600 to-orange-500',
    conditions: 'จำกัด 1 ครั้งต่อคน',
    validFrom: new Date('2026-03-01'),
    validUntil: new Date('2026-06-30'),
  },
  {
    id: 'promo_rama9_open',
    title: 'เปิดสาขาพระราม 9',
    description: 'ฉลองเปิดสาขาใหม่',
    branchIds: ['branch_c02', 'branch_b01'],
    gradient: 'from-blue-600 to-cyan-500',
    conditions: 'เฉพาะ 100 สิทธิ์แรก',
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
  },
];

const rewards = [
  {
    id: 'reward_discount_30',
    code: 'DISC30',
    name: 'เธชเนเธงเธเธฅเธ” 30 เธเธฒเธ—',
    description: 'เนเธเนเนเธ”เนเธเธฑเธเธ—เธธเธเนเธเนเธเน€เธเธ',
    pointsCost: 300,
    category: 'discount',
    icon: 'tag',
    iconBg: 'bg-orange-500/20',
    sortOrder: 1,
    branchIds: [],
  },
  {
    id: 'reward_discount_50',
    code: 'DISC50',
    name: 'เธชเนเธงเธเธฅเธ” 50 เธเธฒเธ—',
    description: 'เนเธเนเนเธ”เนเธเธฑเธเธ—เธธเธเนเธเนเธเน€เธเธ',
    pointsCost: 500,
    category: 'discount',
    icon: 'tag',
    iconBg: 'bg-orange-500/20',
    sortOrder: 2,
    branchIds: [],
  },
  {
    id: 'reward_special_100',
    code: 'DISC100',
    name: 'เธชเนเธงเธเธฅเธ” 100 เธเธฒเธ—',
    description: 'เนเธเนเนเธ”เนเธเธฑเธเนเธเนเธ SPECIAL MODE',
    pointsCost: 800,
    category: 'discount',
    tag: 'HOT',
    icon: 'tag',
    iconBg: 'bg-red-500/20',
    sortOrder: 3,
    branchIds: [],
  },
  {
    id: 'reward_vacuum',
    code: 'VACFREE',
    name: 'เธ”เธนเธ”เธเธธเนเธเธเธฃเธต',
    description: 'เธเธฃเธดเธเธฒเธฃเธ”เธนเธ”เธเธธเนเธเธ เธฒเธขเนเธเธเธฃเธต 1 เธเธฃเธฑเนเธ',
    pointsCost: 500,
    category: 'service',
    icon: 'wind',
    iconBg: 'bg-blue-500/20',
    sortOrder: 4,
    branchIds: ['branch_c01', 'branch_c02', 'branch_c04'],
  },
  {
    id: 'reward_free_wash',
    code: 'FREEWASH',
    name: 'เธฅเนเธฒเธเธฃเธ–เธเธฃเธต 1 เธเธฃเธฑเนเธ',
    description: 'QUICK & CLEAN เนเธเธชเน S-M',
    pointsCost: 2000,
    category: 'service',
    tag: 'BEST',
    icon: 'car',
    iconBg: 'bg-green-500/20',
    sortOrder: 5,
    branchIds: [],
  },
];

const testUsers = [
  {
    id: 'user_demo_001',
    lineUserId: 'dev_user_001',
    displayName: 'Demo User',
    tier: 'gold' as const,
    totalPoints: 1250,
    totalWashes: 14,
    phone: '0811111111',
  },
  {
    id: 'user_demo_002',
    lineUserId: 'dev_user_002',
    displayName: 'Branch Loyal Customer',
    tier: 'silver' as const,
    totalPoints: 620,
    totalWashes: 8,
    phone: '0822222222',
  },
];

async function upsertPackages() {
  for (const pkg of packages) {
    await prisma.washPackage.upsert({
      where: { id: pkg.id },
      update: {
        code: pkg.code,
        name: pkg.name,
        description: pkg.description,
        vehicleType: pkg.vehicleType,
        priceS: pkg.priceS,
        priceM: pkg.priceM,
        priceL: pkg.priceL,
        steps: pkg.steps,
        stepDuration: pkg.stepDuration,
        image: pkg.image ?? null,
        sortOrder: pkg.sortOrder,
        isActive: true,
      },
      create: pkg,
    });
  }
}

async function upsertBranches() {
  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      update: {
        code: branch.code,
        name: branch.name,
        shortName: branch.shortName,
        address: branch.address,
        area: branch.area,
        type: branch.type,
        ownershipType: branch.ownershipType,
        franchiseCode: branch.franchiseCode ?? null,
        lat: branch.lat,
        lng: branch.lng,
        hours: branch.hours,
        promptPayId: branch.promptPayId,
        promptPayName: branch.promptPayName,
        ownerName: branch.ownerName ?? null,
        mapsUrl: branch.mapsUrl,
        isActive: true,
      },
      create: {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        shortName: branch.shortName,
        address: branch.address,
        area: branch.area,
        type: branch.type,
        ownershipType: branch.ownershipType,
        franchiseCode: branch.franchiseCode ?? null,
        lat: branch.lat,
        lng: branch.lng,
        hours: branch.hours,
        promptPayId: branch.promptPayId,
        promptPayName: branch.promptPayName,
        ownerName: branch.ownerName ?? null,
        mapsUrl: branch.mapsUrl,
        isActive: true,
      },
    });

    await prisma.branchSettings.upsert({
      where: { branchId: branch.id },
      update: {
        supportPhone: branch.supportPhone,
        pointsEarnRate: branch.pointsEarnRate ?? 10,
        allowsPointRedemption: true,
      },
      create: {
        branchId: branch.id,
        supportPhone: branch.supportPhone,
        pointsEarnRate: branch.pointsEarnRate ?? 10,
      },
    });
  }
}

async function upsertMachines() {
  for (const branch of branches) {
    const isBikeBranch = branch.type === 'motorcycle';
    const configs = isBikeBranch
      ? [
          { id: `${branch.id}_moto_01`, code: 'B1', name: 'ตู้ล้างมอเตอร์ไซค์ B1', type: 'motorcycle', espDeviceId: `ESP32-${branch.code}-B1`, sortOrder: 1 },
          { id: `${branch.id}_moto_02`, code: 'B2', name: 'ตู้ล้างมอเตอร์ไซค์ B2', type: 'motorcycle', espDeviceId: `ESP32-${branch.code}-B2`, sortOrder: 2 },
        ]
      : [
          { id: `${branch.id}_car_01`, code: 'A1', name: 'ตู้ล้างรถ A1', type: 'car', espDeviceId: `ESP32-${branch.code}-A1`, sortOrder: 1 },
          { id: `${branch.id}_car_02`, code: 'A2', name: 'ตู้ล้างรถ A2', type: 'car', espDeviceId: `ESP32-${branch.code}-A2`, sortOrder: 2 },
          { id: `${branch.id}_moto_01`, code: 'B1', name: 'ตู้ล้างมอเตอร์ไซค์ B1', type: 'motorcycle', espDeviceId: `ESP32-${branch.code}-B1`, sortOrder: 3 },
        ];

    for (const machine of configs) {
      await prisma.machine.upsert({
        where: { id: machine.id },
        update: {
          branchId: branch.id,
          code: machine.code,
          name: machine.name,
          type: machine.type,
          espDeviceId: machine.espDeviceId,
          status: 'idle',
          isEnabled: true,
          sortOrder: machine.sortOrder,
        },
        create: {
          ...machine,
          branchId: branch.id,
          status: 'idle',
          isEnabled: true,
        },
      });
    }
  }
}

async function upsertBranchPackageConfigs() {
  for (const branch of branches) {
    const allowedPackageIds =
      branch.type === 'motorcycle'
        ? ['pkg_moto_quick', 'pkg_moto_shine', 'pkg_moto_premium']
        : ['pkg_quick', 'pkg_shine', 'pkg_special', 'pkg_vacuum'];

    for (const packageId of allowedPackageIds) {
      const override = branchPackageOverrides[branch.id]?.[packageId];
      await prisma.branchPackageConfig.upsert({
        where: {
          branchId_packageId: {
            branchId: branch.id,
            packageId,
          },
        },
        update: {
          isActive: true,
          isVisible: override?.isVisible ?? true,
          priceOverrideS: override?.S ?? null,
          priceOverrideM: override?.M ?? null,
          priceOverrideL: override?.L ?? null,
        },
        create: {
          branchId: branch.id,
          packageId,
          isActive: true,
          isVisible: override?.isVisible ?? true,
          priceOverrideS: override?.S ?? null,
          priceOverrideM: override?.M ?? null,
          priceOverrideL: override?.L ?? null,
        },
      });
    }
  }
}

async function upsertBranchPaymentConfigs() {
  // All branches use Ksher PromptPay gateway
  for (const branch of branches) {
    const mode = branch.ownershipType === 'company_owned' ? 'hq_managed' : 'branch_managed';
    const provider = 'ksher';
    const settlementOwnerType = branch.ownershipType === 'company_owned' ? 'hq' : 'franchisee';

    const config = await prisma.branchPaymentConfig.upsert({
      where: {
        id: `paycfg_${branch.id}`,
      },
      update: {
        branchId: branch.id,
        mode,
        provider,
        isActive: true,
        displayName: `${branch.shortName || branch.name} Ksher PromptPay`,
        statementName: branch.promptPayName,
        settlementOwnerType,
      },
      create: {
        id: `paycfg_${branch.id}`,
        branchId: branch.id,
        mode,
        provider,
        isActive: true,
        displayName: `${branch.shortName || branch.name} Ksher PromptPay`,
        statementName: branch.promptPayName,
        settlementOwnerType,
      },
    });

    const credentials = [
      {
        key: 'promptpay_id',
        value: branch.promptPayId,
        isSecret: false,
      },
      {
        key: 'promptpay_name',
        value: branch.promptPayName,
        isSecret: false,
      },
    ];

    for (const credential of credentials) {
      await prisma.branchPaymentCredential.upsert({
        where: {
          branchPaymentConfigId_key: {
            branchPaymentConfigId: config.id,
            key: credential.key,
          },
        },
        update: {
          valueEncrypted: encryptBranchPaymentCredential(credential.value),
          maskedValue: maskCredentialValue(credential.value, credential.isSecret),
          isSecret: credential.isSecret,
        },
        create: {
          branchPaymentConfigId: config.id,
          key: credential.key,
          valueEncrypted: encryptBranchPaymentCredential(credential.value),
          maskedValue: maskCredentialValue(credential.value, credential.isSecret),
          isSecret: credential.isSecret,
        },
      });
    }

    // Ksher supports webhook, polling, dynamic QR, reference binding, and refund
    await prisma.branchPaymentCapability.upsert({
      where: {
        branchPaymentConfigId: config.id,
      },
      update: {
        supportsWebhook: true,
        supportsPolling: true,
        supportsDynamicQr: true,
        supportsReferenceBinding: true,
        supportsRefund: true,
        supportsSliplessConfirmation: true,
      },
      create: {
        branchPaymentConfigId: config.id,
        supportsWebhook: true,
        supportsPolling: true,
        supportsDynamicQr: true,
        supportsReferenceBinding: true,
        supportsRefund: true,
        supportsSliplessConfirmation: true,
      },
    });
  }
}

async function upsertCoupons() {
  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { id: coupon.id },
      update: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        scope: coupon.scope,
        status: 'active',
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minSpend: coupon.minSpend,
        maxUses: coupon.maxUses,
        maxUsesPerUser: coupon.maxUsesPerUser,
        isPurchasable: coupon.isPurchasable,
        purchasePrice: coupon.purchasePrice,
        packageIds: coupon.packageIds,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
      },
      create: {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        scope: coupon.scope,
        status: 'active',
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minSpend: coupon.minSpend,
        maxUses: coupon.maxUses,
        maxUsesPerUser: coupon.maxUsesPerUser,
        isPurchasable: coupon.isPurchasable,
        purchasePrice: coupon.purchasePrice,
        packageIds: coupon.packageIds,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
      },
    });

    for (const branchId of coupon.branchIds) {
      await prisma.couponBranchLink.upsert({
        where: {
          couponId_branchId: {
            couponId: coupon.id,
            branchId,
          },
        },
        update: {},
        create: {
          couponId: coupon.id,
          branchId,
        },
      });
    }
  }
}

async function upsertPromotions() {
  for (const promotion of promotions) {
    await prisma.promotion.upsert({
      where: { id: promotion.id },
      update: promotion,
      create: promotion,
    });
  }
}

async function upsertRewards() {
  for (const reward of rewards) {
    await prisma.rewardCatalog.upsert({
      where: { id: reward.id },
      update: reward,
      create: reward,
    });
  }
}

async function upsertUsersAndWallets() {
  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        lineUserId: user.lineUserId,
        displayName: user.displayName,
        phone: user.phone,
        tier: user.tier,
        totalPoints: user.totalPoints,
        totalWashes: user.totalWashes,
      },
      create: {
        ...user,
      },
    });

    const wallet = await prisma.pointWallet.upsert({
      where: { userId: user.id },
      update: {
        balance: user.totalPoints,
        lifetimeEarned: user.totalPoints,
        lifetimeRedeemed: 0,
      },
      create: {
        userId: user.id,
        balance: user.totalPoints,
        lifetimeEarned: user.totalPoints,
        lifetimeRedeemed: 0,
      },
    });

    await prisma.pointsTransaction.upsert({
      where: { id: `pt_init_${user.id}` },
      update: {
        walletId: wallet.id,
        amount: user.totalPoints,
        balanceAfter: user.totalPoints,
        description: 'Initial seed balance',
      },
      create: {
        id: `pt_init_${user.id}`,
        walletId: wallet.id,
        userId: user.id,
        type: 'adjust',
        amount: user.totalPoints,
        balanceAfter: user.totalPoints,
        description: 'Initial seed balance',
      },
    });

    await prisma.stamp.upsert({
      where: { id: `stamp_${user.id}` },
      update: {
        userId: user.id,
        currentCount: Math.min(user.totalWashes, 10),
        targetCount: 10,
        rewardClaimed: false,
      },
      create: {
        id: `stamp_${user.id}`,
        userId: user.id,
        currentCount: Math.min(user.totalWashes, 10),
        targetCount: 10,
      },
    });

    await prisma.piggyBank.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  await prisma.userCoupon.upsert({
    where: { userId_couponId: { userId: 'user_demo_001', couponId: 'coupon_welcome_all' } },
    update: { status: 'claimed' },
    create: {
      userId: 'user_demo_001',
      couponId: 'coupon_welcome_all',
      status: 'claimed',
    },
  });

  await prisma.feedback.upsert({
    where: { id: 'feedback_seed_001' },
    update: {
      userId: 'user_demo_001',
      branchId: 'branch_c01',
      type: 'service',
      message: 'Need help checking a recent wash and points posting.',
      status: 'pending',
      adminNotes: null,
      resolvedAt: null,
    },
    create: {
      id: 'feedback_seed_001',
      userId: 'user_demo_001',
      branchId: 'branch_c01',
      type: 'service',
      message: 'Need help checking a recent wash and points posting.',
      status: 'pending',
    },
  });
}

async function upsertAdmins() {
  const hqPassword = await bcrypt.hash('admin123', 12);
  const branchPassword = await bcrypt.hash('manager123', 12);
  const eastPassword = await bcrypt.hash('branch123', 12);
  const cashierPassword = await bcrypt.hash('cashier123', 12);

  const hqAdmin = await prisma.adminUser.upsert({
    where: { email: 'admin@roboss.co.th' },
    update: {
      name: 'ROBOSS HQ Admin',
      role: 'hq_admin',
      isActive: true,
    },
    create: {
      email: 'admin@roboss.co.th',
      passwordHash: hqPassword,
      name: 'ROBOSS HQ Admin',
      role: 'hq_admin',
    },
  });

  const ramaAdmin = await prisma.adminUser.upsert({
    where: { email: 'rama.manager@roboss.co.th' },
    update: {
      name: 'Bangkok Branch Admin',
      role: 'branch_admin',
      isActive: true,
    },
    create: {
      email: 'rama.manager@roboss.co.th',
      passwordHash: branchPassword,
      name: 'Bangkok Branch Admin',
      role: 'branch_admin',
    },
  });

  const eastAdmin = await prisma.adminUser.upsert({
    where: { email: 'east.manager@roboss.co.th' },
    update: {
      name: 'East Zone Branch Admin',
      role: 'branch_admin',
      isActive: true,
    },
    create: {
      email: 'east.manager@roboss.co.th',
      passwordHash: eastPassword,
      name: 'East Zone Branch Admin',
      role: 'branch_admin',
    },
  });

  const cashier = await prisma.adminUser.upsert({
    where: { email: 'cashier@roboss.co.th' },
    update: {
      name: 'Rama 9 Cashier',
      role: 'cashier',
      isActive: true,
    },
    create: {
      email: 'cashier@roboss.co.th',
      passwordHash: cashierPassword,
      name: 'Rama 9 Cashier',
      role: 'cashier',
    },
  });

  const scopes = [
    { adminUserId: ramaAdmin.id, branchId: 'branch_c01' },
    { adminUserId: ramaAdmin.id, branchId: 'branch_c02' },
    { adminUserId: eastAdmin.id, branchId: 'branch_c04' },
    { adminUserId: eastAdmin.id, branchId: 'branch_b01' },
  ];

  for (const scope of scopes) {
    await prisma.adminBranchScope.upsert({
      where: {
        adminUserId_branchId: {
          adminUserId: scope.adminUserId,
          branchId: scope.branchId,
        },
      },
      update: {
        canManageCoupons: true,
        canManageMachines: true,
        canViewRevenue: true,
      },
      create: scope,
    });
  }

  await prisma.adminBranchScope.upsert({
    where: {
      adminUserId_branchId: {
        adminUserId: cashier.id,
        branchId: 'branch_c01',
      },
    },
    update: {
      canManageCoupons: false,
      canManageMachines: false,
      canViewRevenue: false,
    },
    create: {
      adminUserId: cashier.id,
      branchId: 'branch_c01',
      canManageCoupons: false,
      canManageMachines: false,
      canViewRevenue: false,
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'audit_seed_hq_admin' },
    update: {
      actorType: 'admin',
      adminUserId: hqAdmin.id,
      action: 'seed.bootstrap',
      entityType: 'system',
      entityId: 'seed',
    },
    create: {
      id: 'audit_seed_hq_admin',
      actorType: 'admin',
      adminUserId: hqAdmin.id,
      action: 'seed.bootstrap',
      entityType: 'system',
      entityId: 'seed',
      metadata: { source: 'prisma.seed.ts' },
    },
  });
}

async function main() {
  console.log('Seeding ROBOSS Sprint 1 foundation...');

  await upsertPackages();
  await upsertBranches();
  await upsertMachines();
  await upsertBranchPackageConfigs();
  await upsertBranchPaymentConfigs();
  await upsertCoupons();
  await upsertPromotions();
  await upsertRewards();
  await upsertUsersAndWallets();
  await upsertAdmins();

  console.log(`Seed completed:
  branches: ${branches.length}
  packages: ${packages.length}
  coupons: ${coupons.length}
  promotions: ${promotions.length}
  rewards: ${rewards.length}
  test users: ${testUsers.length}
  admins: 4`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
