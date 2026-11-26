// Mock data for ROBOSS Car Wash — 22 branches

export interface BranchPackage {
  id: string;
  name: string;
  vehicleType: 'car' | 'motorcycle';
  prices: { S: number; M: number; L: number };
  steps: string[];
  stepDuration: number; // seconds per step
  isActive: boolean;
  image: string;
}

export interface Machine {
  id: string;
  name: string;
  type: 'car' | 'motorcycle';
  status: 'idle' | 'reserved' | 'washing' | 'maintenance' | 'offline';
  espDeviceId: string;
}

export interface Branch {
  id: string;
  name: string;
  type: 'car' | 'motorcycle';
  location: { lat: number; lng: number };
  promptPayId: string;
  promptPayName: string;
  isActive: boolean;
  packages: BranchPackage[];
  machines: Machine[];
}

export interface WashSession {
  id: string;
  branchId: string;
  machineId: string;
  userId: string;
  vehicleType: 'car' | 'motorcycle';
  packageId: string;
  carSize: 'S' | 'M' | 'L';
  addons: string[];
  totalPrice: number;
  status: 'pending_payment' | 'ready_to_wash' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded' | 'expired';
  washStatus: 'waiting' | 'ready' | 'in_progress' | 'completed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  progress: number;
  pointsEarned: number;
  rating: number | null;
  reviewText?: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string;
  points: number;
  totalWashes: number;
  memberSince: Date;
}

const defaultCarPackages: Omit<BranchPackage, 'prices'>[] = [
  {
    id: 'quick',
    name: 'QUICK & CLEAN',
    vehicleType: 'car',
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง'],
    stepDuration: 300,
    isActive: true,
    image: '/freepik_0001.png',
  },
  {
    id: 'shine',
    name: 'SHINE MODE',
    vehicleType: 'car',
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงา'],
    stepDuration: 300,
    isActive: true,
    image: '/freepik_0001_(1).png',
  },
  {
    id: 'special',
    name: 'SPECIAL MODE',
    vehicleType: 'car',
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงา'],
    stepDuration: 300,
    isActive: true,
    image: '/freepik_0001_(2).png',
  },
];

const defaultAddon = {
  id: 'vacuum',
  name: 'ดูดฝุ่นภายใน',
  vehicleType: 'car' as const,
  steps: ['ดูดฝุ่น'],
  stepDuration: 300,
  isActive: true,
  image: '/freepik_0001_(3).png',
};

// Motorcycle wash uses a single flat price (no S/M/L size). We keep the S/M/L
// shape for compatibility but set all three to the same value, and the customer
// flow hides the size selector for motorcycle branches.
function flatPrice(price: number): { S: number; M: number; L: number } {
  return { S: price, M: price, L: price };
}

// Real ROBOSS motorcycle pricing: base wash 49฿ / 1-3 min (touchless).
const defaultMotorcyclePackages: BranchPackage[] = [
  {
    id: 'moto_quick',
    name: 'MOTO QUICK 49',
    vehicleType: 'motorcycle',
    prices: flatPrice(49),
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'เป่าแห้ง'],
    stepDuration: 60,
    isActive: true,
    image: '/freepik_0001.png',
  },
  {
    id: 'moto_shine',
    name: 'MOTO SHINE 69',
    vehicleType: 'motorcycle',
    prices: flatPrice(69),
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'เป่าแห้ง', 'เคลือบเงา'],
    stepDuration: 60,
    isActive: true,
    image: '/freepik_0001_(1).png',
  },
  {
    id: 'moto_premium',
    name: 'MOTO PREMIUM 99',
    vehicleType: 'motorcycle',
    prices: flatPrice(99),
    steps: ['ฉีดน้ำแรงดันสูง', 'ล้างโฟมสลายคราบ', 'ขัดล้างอัตโนมัติ', 'เป่าแห้ง', 'เคลือบเงา'],
    stepDuration: 60,
    isActive: true,
    image: '/freepik_0001_(2).png',
  },
];

// Real ROBOSS branches with actual coordinates
interface RealBranch {
  id: string;
  name: string;
  address: string;
  area: string;
  location: { lat: number; lng: number };
  mapsUrl: string;
  promptPayId: string;
  promptPayName: string;
  priceMultiplier: number;
}

const realBranches: RealBranch[] = [
  {
    id: 'branch_c01',
    name: 'ROBOSS รามอินทรา 109',
    address: '99/9 ถ.รามอินทรา กม.9 แขวงคันนายาว เขตคันนายาว กรุงเทพฯ',
    area: 'กรุงเทพฯ (คันนายาว)',
    location: { lat: 13.8682, lng: 100.6378 },
    mapsUrl: 'https://maps.app.goo.gl/ut1MVhuveKSvmiS27',
    promptPayId: '0891234567',
    promptPayName: 'ROBOSS รามอินทรา 109',
    priceMultiplier: 1.0,
  },
  {
    id: 'branch_c02',
    name: 'ROBOSS พระราม 9',
    address: '1 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ',
    area: 'กรุงเทพฯ (ห้วยขวาง)',
    location: { lat: 13.7489, lng: 100.5714 },
    mapsUrl: 'https://maps.app.goo.gl/vAZEwXHVvJkPc7yJ7',
    promptPayId: '0892345678',
    promptPayName: 'ROBOSS พระราม 9',
    priceMultiplier: 1.0,
  },
  {
    id: 'branch_c03',
    name: 'ROBOSS ท่าพระ',
    address: '8/1 ถ.ท่าพระ แขวงบางยี่เรือ เขตธนบุรี กรุงเทพฯ',
    area: 'กรุงเทพฯ (ธนบุรี)',
    location: { lat: 13.7260, lng: 100.4785 },
    mapsUrl: 'https://maps.app.goo.gl/SC7SsTxuR1bpcpnq9',
    promptPayId: '0893456789',
    promptPayName: 'ROBOSS ท่าพระ',
    priceMultiplier: 1.0,
  },
  {
    id: 'branch_c04',
    name: 'ROBOSS ชลบุรี',
    address: '99 ถ.สุขุมวิท ต.บ้านสวน อ.เมือง จ.ชลบุรี',
    area: 'ชลบุรี',
    location: { lat: 13.3611, lng: 100.9847 },
    mapsUrl: 'https://maps.app.goo.gl/H1xqWbL8BETheHpc6',
    promptPayId: '0894567890',
    promptPayName: 'ROBOSS ชลบุรี',
    priceMultiplier: 0.95,
  },
  {
    id: 'branch_c05',
    name: 'ROBOSS สตูล',
    address: '15 ถ.สตูลธานี ต.พิมาน อ.เมือง จ.สตูล',
    area: 'สตูล',
    location: { lat: 6.6238, lng: 100.0674 },
    mapsUrl: 'https://maps.app.goo.gl/tQLW2vdJ1bHygoBF7',
    promptPayId: '0895678901',
    promptPayName: 'ROBOSS สตูล',
    priceMultiplier: 0.9,
  },
  {
    id: 'branch_c06',
    name: 'ROBOSS นครศรีธรรมราช',
    address: '55 ถ.ราชดำเนิน ต.ในเมือง อ.เมือง จ.นครศรีธรรมราช',
    area: 'นครศรีธรรมราช',
    location: { lat: 8.4327, lng: 99.9638 },
    mapsUrl: 'https://maps.app.goo.gl/qdMDCMGr6LfagE2N8',
    promptPayId: '0896789012',
    promptPayName: 'ROBOSS นครศรีธรรมราช',
    priceMultiplier: 0.9,
  },
  {
    id: 'branch_c07',
    name: 'ROBOSS อุทัยธานี',
    address: '123 ถ.ศรีอุทัย ต.อุทัยใหม่ อ.เมือง จ.อุทัยธานี',
    area: 'อุทัยธานี',
    location: { lat: 15.3833, lng: 100.0247 },
    mapsUrl: 'https://maps.app.goo.gl/8dn8U7UiKFwY3dST7',
    promptPayId: '0897890123',
    promptPayName: 'ROBOSS อุทัยธานี',
    priceMultiplier: 0.9,
  },
];

const basePrices = {
  // Real ROBOSS car wash starts at 99฿ (official promo).
  quick: { S: 99, M: 119, L: 139 },
  shine: { S: 139, M: 149, L: 169 },
  special: { S: 339, M: 399, L: 469 },
  vacuum: { S: 70, M: 90, L: 120 },
};

function roundToNearest(n: number): number {
  if (n < 10) return Math.max(1, Math.round(n));
  return Math.round(n / 10) * 10 - 1;
}

export const branches: Branch[] = realBranches.map((rb) => ({
  id: rb.id,
  name: rb.name,
  type: 'car',
  address: rb.address,
  area: rb.area,
  location: rb.location,
  mapsUrl: rb.mapsUrl,
  promptPayId: rb.promptPayId,
  promptPayName: rb.promptPayName,
  isActive: true,
  packages: [
    ...defaultCarPackages.map(pkg => ({
      ...pkg,
      prices: {
        S: roundToNearest(basePrices[pkg.id as keyof typeof basePrices].S * rb.priceMultiplier),
        M: roundToNearest(basePrices[pkg.id as keyof typeof basePrices].M * rb.priceMultiplier),
        L: roundToNearest(basePrices[pkg.id as keyof typeof basePrices].L * rb.priceMultiplier),
      },
    })),
    {
      ...defaultAddon,
      prices: {
        S: roundToNearest(basePrices.vacuum.S * rb.priceMultiplier),
        M: roundToNearest(basePrices.vacuum.M * rb.priceMultiplier),
        L: roundToNearest(basePrices.vacuum.L * rb.priceMultiplier),
      },
    },
  ],
  machines: [
    { id: `${rb.id}_car_01`, name: 'ตู้ล้างรถ A1', type: 'car', status: 'idle', espDeviceId: `ESP32-${rb.id}-CAR01` },
    { id: `${rb.id}_car_02`, name: 'ตู้ล้างรถ A2', type: 'car', status: 'idle', espDeviceId: `ESP32-${rb.id}-CAR02` },
    { id: `${rb.id}_moto_01`, name: 'ตู้ล้างมอไซค์ B1', type: 'motorcycle', status: 'idle', espDeviceId: `ESP32-${rb.id}-MOTO01` },
  ],
}));

// Dedicated motorcycle-only franchises: motorcycle wash category only, no cars.
interface RealMotorcycleBranch {
  id: string;
  name: string;
  address: string;
  area: string;
  location: { lat: number; lng: number };
  mapsUrl: string;
  promptPayId: string;
  promptPayName: string;
}

// IDs align with the motorcycle branches in branchContext (branch_b01..b06) so a
// motorcycle branch selected in the picker resolves to a motorcycle branch here.
const realMotorcycleBranches: RealMotorcycleBranch[] = [
  {
    id: 'branch_b01',
    name: 'ROBOSS ล้างมอไซค์ พระราม 9',
    address: '204 ซ.โรงพยาบาลพระราม 9 แขวงห้วยขวาง กรุงเทพฯ',
    area: 'กรุงเทพฯ (ห้วยขวาง)',
    location: { lat: 13.7571, lng: 100.569 },
    mapsUrl: 'https://maps.app.goo.gl/vAZEwXHVvJkPc7yJ7',
    promptPayId: '0901112201',
    promptPayName: 'ROBOSS ล้างมอไซค์ พระราม 9',
  },
  {
    id: 'branch_b02',
    name: 'ROBOSS ล้างมอไซค์ พระราม 4',
    address: 'ปตท. พระราม 4 แขวงพระโขนง เขตคลองเตย กรุงเทพฯ',
    area: 'กรุงเทพฯ (คลองเตย)',
    location: { lat: 13.716, lng: 100.5746 },
    mapsUrl: 'https://maps.app.goo.gl/WhtiRPuwrRzrwgHF7',
    promptPayId: '0901112202',
    promptPayName: 'ROBOSS ล้างมอไซค์ พระราม 4',
  },
  {
    id: 'branch_b03',
    name: 'ROBOSS ล้างมอไซค์ ท่าพระ',
    address: '182/1 ซ.เทอดไท 33 แขวงดาวคะนอง เขตธนบุรี กรุงเทพฯ',
    area: 'กรุงเทพฯ (ธนบุรี)',
    location: { lat: 13.7159, lng: 100.4762 },
    mapsUrl: 'https://maps.app.goo.gl/F5GfLG99U1SDzy28A',
    promptPayId: '0901112203',
    promptPayName: 'ROBOSS ล้างมอไซค์ ท่าพระ',
  },
  {
    id: 'branch_b04',
    name: 'ROBOSS ล้างมอไซค์ ชลบุรี',
    address: 'ต.นาป่า อ.เมืองชลบุรี จ.ชลบุรี',
    area: 'ชลบุรี',
    location: { lat: 13.3046, lng: 100.9024 },
    mapsUrl: 'https://maps.app.goo.gl/6FdX7LG31ozszmc29',
    promptPayId: '0901112204',
    promptPayName: 'ROBOSS ล้างมอไซค์ ชลบุรี',
  },
  {
    id: 'branch_b05',
    name: 'ROBOSS ล้างมอไซค์ ภูเก็ต',
    address: '78/162 ต.สามกอง อ.เมืองภูเก็ต จ.ภูเก็ต',
    area: 'ภูเก็ต',
    location: { lat: 7.8992, lng: 98.3761 },
    mapsUrl: 'https://maps.app.goo.gl/oazz3WiRR5ghx8SAA',
    promptPayId: '0901112205',
    promptPayName: 'ROBOSS ล้างมอไซค์ ภูเก็ต',
  },
  {
    id: 'branch_b06',
    name: 'ROBOSS ล้างมอไซค์ แม่สอด',
    address: 'ปั๊มบางจาก ต.แม่ปะ อ.แม่สอด จ.ตาก',
    area: 'ตาก (แม่สอด)',
    location: { lat: 16.7511, lng: 98.5721 },
    mapsUrl: 'https://maps.app.goo.gl/BbHegYXa99rbBCGC9',
    promptPayId: '0901112206',
    promptPayName: 'ROBOSS ล้างมอไซค์ แม่สอด',
  },
];

const motorcycleBranches: Branch[] = realMotorcycleBranches.map((mb) => ({
  id: mb.id,
  name: mb.name,
  type: 'motorcycle',
  address: mb.address,
  area: mb.area,
  location: mb.location,
  mapsUrl: mb.mapsUrl,
  promptPayId: mb.promptPayId,
  promptPayName: mb.promptPayName,
  isActive: true,
  packages: defaultMotorcyclePackages.map((pkg) => ({ ...pkg, prices: { ...pkg.prices } })),
  machines: [
    { id: `${mb.id}_moto_01`, name: 'ตู้ล้างมอไซค์ B1', type: 'motorcycle', status: 'idle', espDeviceId: `ESP32-${mb.id}-MOTO01` },
    { id: `${mb.id}_moto_02`, name: 'ตู้ล้างมอไซค์ B2', type: 'motorcycle', status: 'idle', espDeviceId: `ESP32-${mb.id}-MOTO02` },
  ],
}));

branches.push(...motorcycleBranches);


// Default mock user
export const mockUser: User = {
  id: 'line_user_001',
  displayName: 'W',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100',
  points: 1250,
  totalWashes: 14,
  memberSince: new Date('2025-01-15'),
};

// Points rate: 1 baht = 10 points
export const POINTS_RATE = 10;
