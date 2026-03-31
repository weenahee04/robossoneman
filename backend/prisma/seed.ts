import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Wash Packages ─────────────────────────────────────
  const quickPkg = await prisma.washPackage.upsert({
    where: { id: 'pkg_quick' },
    update: {},
    create: {
      id: 'pkg_quick',
      name: 'QUICK & CLEAN',
      description: 'ล้างรถเร็ว สะอาด พื้นฐาน',
      vehicleType: 'car',
      priceS: 99,
      priceM: 109,
      priceL: 129,
      steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง'],
      stepDuration: 300,
      image: '/freepik_0001.png',
      sortOrder: 1,
    },
  });

  const shinePkg = await prisma.washPackage.upsert({
    where: { id: 'pkg_shine' },
    update: {},
    create: {
      id: 'pkg_shine',
      name: 'SHINE MODE',
      description: 'ล้าง + เคลือบเงา',
      vehicleType: 'car',
      priceS: 139,
      priceM: 149,
      priceL: 169,
      steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงา'],
      stepDuration: 300,
      image: '/freepik_0001_(1).png',
      sortOrder: 2,
    },
  });

  const specialPkg = await prisma.washPackage.upsert({
    where: { id: 'pkg_special' },
    update: {},
    create: {
      id: 'pkg_special',
      name: 'SPECIAL MODE',
      description: 'ล้าง + เคลือบเงา แบบพิเศษ',
      vehicleType: 'car',
      priceS: 339,
      priceM: 399,
      priceL: 469,
      steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงา'],
      stepDuration: 300,
      image: '/freepik_0001_(2).png',
      sortOrder: 3,
    },
  });

  await prisma.washPackage.upsert({
    where: { id: 'pkg_vacuum' },
    update: {},
    create: {
      id: 'pkg_vacuum',
      name: 'ดูดฝุ่นภายใน',
      description: 'ดูดฝุ่นภายในรถ',
      vehicleType: 'car',
      priceS: 70,
      priceM: 90,
      priceL: 120,
      steps: ['ดูดฝุ่น'],
      stepDuration: 300,
      image: '/freepik_0001_(3).png',
      sortOrder: 4,
    },
  });

  const motoQuickPkg = await prisma.washPackage.upsert({
    where: { id: 'pkg_moto_quick' },
    update: {},
    create: {
      id: 'pkg_moto_quick',
      name: 'MOTO CLEAN',
      description: 'ล้างมอเตอร์ไซค์ พื้นฐาน',
      vehicleType: 'motorcycle',
      priceS: 49,
      priceM: 59,
      priceL: 69,
      steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟม', 'เป่าแห้ง'],
      stepDuration: 180,
      sortOrder: 5,
    },
  });

  const motoShinePkg = await prisma.washPackage.upsert({
    where: { id: 'pkg_moto_shine' },
    update: {},
    create: {
      id: 'pkg_moto_shine',
      name: 'MOTO SHINE',
      description: 'ล้างมอเตอร์ไซค์ + เคลือบเงา',
      vehicleType: 'motorcycle',
      priceS: 79,
      priceM: 89,
      priceL: 99,
      steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟม', 'เป่าแห้ง', 'เคลือบเงา'],
      stepDuration: 180,
      sortOrder: 6,
    },
  });

  const carPackages = [quickPkg, shinePkg, specialPkg];
  const motoPackages = [motoQuickPkg, motoShinePkg];

  // ── Car Wash Branches ───────────────────────────────
  const carBranches = [
    {
      id: 'branch_c01',
      name: 'ROBOSS รามอินทรา 109',
      shortName: 'รามอินทรา 109',
      type: 'car',
      address: '99/9 ถ.รามอินทรา กม.9 แขวงคันนายาว เขตคันนายาว กรุงเทพฯ',
      area: 'กรุงเทพฯ (คันนายาว)',
      lat: 13.8682,
      lng: 100.6378,
      hours: '06:00 - 22:00',
      promptPayId: '0891234567',
      promptPayName: 'ROBOSS รามอินทรา 109',
      mapsUrl: 'https://maps.app.goo.gl/ut1MVhuveKSvmiS27',
    },
    {
      id: 'branch_c02',
      name: 'ROBOSS พระราม 9',
      shortName: 'พระราม 9',
      type: 'car',
      address: '1 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ',
      area: 'กรุงเทพฯ (ห้วยขวาง)',
      lat: 13.7489,
      lng: 100.5714,
      hours: '06:00 - 22:00',
      promptPayId: '0892345678',
      promptPayName: 'ROBOSS พระราม 9',
      mapsUrl: 'https://maps.app.goo.gl/vAZEwXHVvJkPc7yJ7',
    },
    {
      id: 'branch_c03',
      name: 'ROBOSS ท่าพระ',
      shortName: 'ท่าพระ',
      type: 'car',
      address: '8/1 ถ.ท่าพระ แขวงบางยี่เรือ เขตธนบุรี กรุงเทพฯ',
      area: 'กรุงเทพฯ (ธนบุรี)',
      lat: 13.726,
      lng: 100.4785,
      hours: '06:00 - 22:00',
      promptPayId: '0893456789',
      promptPayName: 'ROBOSS ท่าพระ',
      mapsUrl: 'https://maps.app.goo.gl/SC7SsTxuR1bpcpnq9',
    },
    {
      id: 'branch_c04',
      name: 'ROBOSS ชลบุรี',
      shortName: 'ชลบุรี',
      type: 'car',
      address: '99 ถ.สุขุมวิท ต.บ้านสวน อ.เมือง จ.ชลบุรี',
      area: 'ชลบุรี',
      lat: 13.3611,
      lng: 100.9847,
      hours: '07:00 - 21:00',
      promptPayId: '0894567890',
      promptPayName: 'ROBOSS ชลบุรี',
      mapsUrl: 'https://maps.app.goo.gl/H1xqWbL8BETheHpc6',
    },
    {
      id: 'branch_c05',
      name: 'ROBOSS สตูล',
      shortName: 'สตูล',
      type: 'car',
      address: '15 ถ.สตูลธานี ต.พิมาน อ.เมือง จ.สตูล',
      area: 'สตูล',
      lat: 6.6238,
      lng: 100.0674,
      hours: '07:00 - 20:00',
      promptPayId: '0895678901',
      promptPayName: 'ROBOSS สตูล',
      mapsUrl: 'https://maps.app.goo.gl/tQLW2vdJ1bHygoBF7',
    },
    {
      id: 'branch_c06',
      name: 'ROBOSS นครศรีธรรมราช',
      shortName: 'นครศรีธรรมราช',
      type: 'car',
      address: '55 ถ.ราชดำเนิน ต.ในเมือง อ.เมือง จ.นครศรีธรรมราช',
      area: 'นครศรีธรรมราช',
      lat: 8.4327,
      lng: 99.9638,
      hours: '07:00 - 21:00',
      promptPayId: '0896789012',
      promptPayName: 'ROBOSS นครศรีธรรมราช',
      mapsUrl: 'https://maps.app.goo.gl/qdMDCMGr6LfagE2N8',
    },
    {
      id: 'branch_c07',
      name: 'ROBOSS อุทัยธานี',
      shortName: 'อุทัยธานี',
      type: 'car',
      address: '123 ถ.ศรีอุทัย ต.อุทัยใหม่ อ.เมือง จ.อุทัยธานี',
      area: 'อุทัยธานี',
      lat: 15.3833,
      lng: 100.0247,
      hours: '07:00 - 20:00',
      promptPayId: '0897890123',
      promptPayName: 'ROBOSS อุทัยธานี',
      mapsUrl: 'https://maps.app.goo.gl/8dn8U7UiKFwY3dST7',
    },
  ];

  // ── Motorcycle Wash Branches ────────────────────────
  const motoBranches = [
    {
      id: 'branch_b01',
      name: 'ROBOSS มอเตอร์ไซค์ พระราม 9',
      shortName: 'มอไซค์ พระราม 9',
      type: 'bike',
      address: '1/2 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ',
      area: 'กรุงเทพฯ (ห้วยขวาง)',
      lat: 13.7485,
      lng: 100.5720,
      hours: '06:00 - 22:00',
      promptPayId: '0898901234',
      promptPayName: 'ROBOSS มอเตอร์ไซค์ พระราม 9',
      mapsUrl: 'https://maps.app.goo.gl/vAZEwXHVvJkPc7yJ7',
    },
    {
      id: 'branch_b02',
      name: 'ROBOSS มอเตอร์ไซค์ พระราม 4',
      shortName: 'มอไซค์ พระราม 4',
      type: 'bike',
      address: '10 ถ.พระราม 4 แขวงคลองเตย เขตคลองเตย กรุงเทพฯ',
      area: 'กรุงเทพฯ (คลองเตย)',
      lat: 13.7220,
      lng: 100.5530,
      hours: '06:00 - 22:00',
      promptPayId: '0899012345',
      promptPayName: 'ROBOSS มอเตอร์ไซค์ พระราม 4',
      mapsUrl: 'https://maps.app.goo.gl/WhtiRPuwrRzrwgHF7',
    },
    {
      id: 'branch_b03',
      name: 'ROBOSS มอเตอร์ไซค์ ท่าพระ',
      shortName: 'มอไซค์ ท่าพระ',
      type: 'bike',
      address: '8/2 ถ.ท่าพระ แขวงบางยี่เรือ เขตธนบุรี กรุงเทพฯ',
      area: 'กรุงเทพฯ (ธนบุรี)',
      lat: 13.7265,
      lng: 100.4790,
      hours: '06:00 - 22:00',
      promptPayId: '0890123456',
      promptPayName: 'ROBOSS มอเตอร์ไซค์ ท่าพระ',
      mapsUrl: 'https://maps.app.goo.gl/F5GfLG99U1SDzy28A',
    },
    {
      id: 'branch_b04',
      name: 'ROBOSS มอเตอร์ไซค์ ชลบุรี',
      shortName: 'มอไซค์ ชลบุรี',
      type: 'bike',
      address: '100 ถ.สุขุมวิท ต.บ้านสวน อ.เมือง จ.ชลบุรี',
      area: 'ชลบุรี',
      lat: 13.3615,
      lng: 100.9850,
      hours: '07:00 - 21:00',
      promptPayId: '0891234568',
      promptPayName: 'ROBOSS มอเตอร์ไซค์ ชลบุรี',
      mapsUrl: 'https://maps.app.goo.gl/6FdX7LG31ozszmc29',
    },
    {
      id: 'branch_b05',
      name: 'ROBOSS มอเตอร์ไซค์ ภูเก็ต',
      shortName: 'มอไซค์ ภูเก็ต',
      type: 'bike',
      address: '22 ถ.ทวีวงศ์ ต.ป่าตอง อ.กะทู้ จ.ภูเก็ต',
      area: 'ภูเก็ต',
      lat: 7.8900,
      lng: 98.2950,
      hours: '07:00 - 21:00',
      promptPayId: '0892345679',
      promptPayName: 'ROBOSS มอเตอร์ไซค์ ภูเก็ต',
      mapsUrl: 'https://maps.app.goo.gl/oazz3WiRR5ghx8SAA',
    },
    {
      id: 'branch_b06',
      name: 'ROBOSS มอเตอร์ไซค์ แม่สอด',
      shortName: 'มอไซค์ แม่สอด',
      type: 'bike',
      address: '33 ถ.ประสาทวิถี ต.แม่สอด อ.แม่สอด จ.ตาก',
      area: 'ตาก (แม่สอด)',
      lat: 16.7130,
      lng: 98.5730,
      hours: '07:00 - 20:00',
      promptPayId: '0893456780',
      promptPayName: 'ROBOSS มอเตอร์ไซค์ แม่สอด',
      mapsUrl: 'https://maps.app.goo.gl/BbHegYXa99rbBCGC9',
    },
  ];

  const allBranches = [...carBranches, ...motoBranches];

  for (const bd of allBranches) {
    const branch = await prisma.branch.upsert({
      where: { id: bd.id },
      update: { shortName: bd.shortName, type: bd.type, hours: bd.hours },
      create: bd,
    });

    const isBike = bd.type === 'bike';
    const machineConfigs = isBike
      ? [
          { suffix: 'moto_01', name: 'ตู้ล้างมอเตอร์ไซค์ B1', type: 'motorcycle', espPrefix: 'MOTO01' },
          { suffix: 'moto_02', name: 'ตู้ล้างมอเตอร์ไซค์ B2', type: 'motorcycle', espPrefix: 'MOTO02' },
        ]
      : [
          { suffix: 'car_01', name: 'ตู้ล้างรถ A1', type: 'car', espPrefix: 'CAR01' },
          { suffix: 'car_02', name: 'ตู้ล้างรถ A2', type: 'car', espPrefix: 'CAR02' },
          { suffix: 'moto_01', name: 'ตู้ล้างมอเตอร์ไซค์ B1', type: 'motorcycle', espPrefix: 'MOTO01' },
        ];

    for (const mc of machineConfigs) {
      await prisma.machine.upsert({
        where: { espDeviceId: `ESP32-${bd.id}-${mc.espPrefix}` },
        update: {},
        create: {
          id: `${bd.id}_${mc.suffix}`,
          branchId: branch.id,
          name: mc.name,
          type: mc.type,
          espDeviceId: `ESP32-${bd.id}-${mc.espPrefix}`,
          status: 'idle',
        },
      });
    }

    const pkgsToLink = isBike ? motoPackages : carPackages;
    for (const pkg of pkgsToLink) {
      await prisma.branchPackageLink.upsert({
        where: {
          branchId_packageId: { branchId: branch.id, packageId: pkg.id },
        },
        update: {},
        create: { branchId: branch.id, packageId: pkg.id },
      });
    }

    if (!isBike) {
      await prisma.branchPackageLink.upsert({
        where: {
          branchId_packageId: { branchId: branch.id, packageId: 'pkg_vacuum' },
        },
        update: {},
        create: { branchId: branch.id, packageId: 'pkg_vacuum' },
      });
    }
  }

  // ── Coupons (branch-specific) ───────────────────────
  const coupons = [
    {
      id: 'coupon_welcome',
      code: 'WELCOME50',
      title: 'สมาชิกใหม่ ลด 50%',
      description: 'ส่วนลด 50% สำหรับสมาชิกใหม่',
      discountType: 'percent' as const,
      discountValue: 50,
      minSpend: 0,
      maxUses: 1000,
      branchIds: [],
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2026-12-31'),
    },
    {
      id: 'coupon_30off',
      code: 'ROBOSS30',
      title: 'ลด 30 บาท',
      description: 'ส่วนลด 30 บาท สำหรับทุกแพ็กเกจ',
      discountType: 'fixed' as const,
      discountValue: 30,
      minSpend: 99,
      maxUses: 500,
      branchIds: [],
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2026-12-31'),
    },
    {
      id: 'coupon_ram109',
      code: 'RAM109NEW',
      title: 'สาขารามอินทรา 109 — สมาชิกใหม่',
      description: 'ลด 40% เฉพาะสาขารามอินทรา 109',
      discountType: 'percent' as const,
      discountValue: 40,
      minSpend: 150,
      maxUses: 200,
      branchIds: ['branch_c01'],
      validFrom: new Date('2025-06-01'),
      validUntil: new Date('2026-12-31'),
    },
    {
      id: 'coupon_rama9',
      code: 'RAMA9VIP',
      title: 'สาขาพระราม 9 VIP',
      description: 'ลด 50 บาท สำหรับ VIP สาขาพระราม 9',
      discountType: 'fixed' as const,
      discountValue: 50,
      minSpend: 139,
      maxUses: 300,
      branchIds: ['branch_c02', 'branch_b01'],
      validFrom: new Date('2025-06-01'),
      validUntil: new Date('2026-12-31'),
    },
    {
      id: 'coupon_chonburi',
      code: 'CHON20',
      title: 'สาขาชลบุรี ลด 20%',
      description: 'ลด 20% เฉพาะสาขาชลบุรี',
      discountType: 'percent' as const,
      discountValue: 20,
      minSpend: 99,
      maxUses: 100,
      branchIds: ['branch_c04', 'branch_b04'],
      validFrom: new Date('2025-06-01'),
      validUntil: new Date('2026-12-31'),
    },
  ];

  for (const cp of coupons) {
    await prisma.coupon.upsert({
      where: { id: cp.id },
      update: { branchIds: cp.branchIds },
      create: cp,
    });
  }

  // ── Promotions (branch-specific) ────────────────────
  const promotions = [
    {
      id: 'promo_summer',
      title: 'โปรหน้าร้อน — ลด 20% ทุกแพ็ก',
      description: 'ฉลองหน้าร้อน ล้างรถลด 20% ทุกแพ็กเกจ ทุกสาขา',
      branchIds: [],
      gradient: 'from-red-600 to-orange-500',
      conditions: 'ใช้ได้ 1 ครั้ง/ท่าน',
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-06-30'),
    },
    {
      id: 'promo_rama9_open',
      title: 'เปิดสาขาใหม่ พระราม 9',
      description: 'ฉลองเปิดสาขาพระราม 9 ล้างฟรี 1 ครั้ง!',
      branchIds: ['branch_c02'],
      gradient: 'from-blue-600 to-cyan-500',
      conditions: 'สำหรับ 100 คนแรก',
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
    },
    {
      id: 'promo_chonburi_special',
      title: 'ชลบุรี SPECIAL — ลด 30%',
      description: 'SPECIAL MODE ลด 30% เฉพาะสาขาชลบุรี',
      branchIds: ['branch_c04'],
      gradient: 'from-purple-600 to-pink-500',
      conditions: 'เฉพาะ SPECIAL MODE',
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-09-30'),
    },
    {
      id: 'promo_bike_launch',
      title: 'เปิดตัวล้างมอเตอร์ไซค์!',
      description: 'บริการล้างมอเตอร์ไซค์ใหม่ — MOTO CLEAN 29 บาท',
      branchIds: ['branch_b01', 'branch_b02', 'branch_b03', 'branch_b04', 'branch_b05', 'branch_b06'],
      gradient: 'from-orange-500 to-amber-400',
      conditions: 'ราคาพิเศษ 1 เดือนแรก',
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-06-30'),
    },
    {
      id: 'promo_satun_nst',
      title: 'ภาคใต้สุดคุ้ม',
      description: 'สาขาสตูล + นครศรีธรรมราช SHINE MODE ลด 25%',
      branchIds: ['branch_c05', 'branch_c06'],
      gradient: 'from-emerald-600 to-teal-500',
      conditions: 'SHINE MODE ขึ้นไป',
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2026-09-30'),
    },
  ];

  for (const p of promotions) {
    await prisma.promotion.upsert({
      where: { id: p.id },
      update: {},
      create: {
        ...p,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
      },
    });
  }

  // ── Admin Users ───────────────────────────────────────
  const hqPassword = await bcrypt.hash('admin123', 12);
  const managerPassword = await bcrypt.hash('manager123', 12);
  const franchisePassword = await bcrypt.hash('franchise123', 12);

  await prisma.adminUser.upsert({
    where: { email: 'admin@roboss.co.th' },
    update: {},
    create: {
      email: 'admin@roboss.co.th',
      passwordHash: hqPassword,
      name: 'ROBOSS Admin (HQ)',
      role: 'hq',
      branchIds: [],
    },
  });

  await prisma.adminUser.upsert({
    where: { email: 'manager@roboss.co.th' },
    update: {},
    create: {
      email: 'manager@roboss.co.th',
      passwordHash: managerPassword,
      name: 'Branch Manager',
      role: 'branch_manager',
      branchIds: ['branch_c01', 'branch_c02'],
    },
  });

  await prisma.adminUser.upsert({
    where: { email: 'franchise@roboss.co.th' },
    update: {},
    create: {
      email: 'franchise@roboss.co.th',
      passwordHash: franchisePassword,
      name: 'Franchise Owner (ภาคใต้)',
      role: 'franchise_owner',
      branchIds: ['branch_c04', 'branch_c05', 'branch_c06', 'branch_b04', 'branch_b05'],
    },
  });

  console.log('Seed completed!');
  console.log(`  ${allBranches.length} branches (${carBranches.length} car + ${motoBranches.length} bike)`);
  console.log(`  ${carPackages.length + motoPackages.length + 1} packages`);
  console.log(`  ${coupons.length} coupons`);
  console.log(`  ${promotions.length} promotions`);
  console.log('  3 admin users');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
