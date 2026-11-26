import { creditPoints, spendPoints } from './points';
import { grantLocalRewardCoupon, type RewardCouponGrant } from './coupon';

export const REWARD_PACK_COST = 200;

export type RewardRarity = 'standard' | 'shine' | 'signature';

export interface RewardPackPrize extends RewardCouponGrant {
  rarity: RewardRarity;
  valueLabel: string;
}

export interface RewardPackOpening {
  id: string;
  prize: RewardPackPrize;
  couponCode: string;
  openedAt: string;
}

interface WeightedPrize extends RewardPackPrize {
  weight: number;
}

const HISTORY_KEY = 'roboss_reward_pack_history';

const PRIZE_POOL: WeightedPrize[] = [
  {
    rewardId: 'save10',
    title: 'ส่วนลดค่าล้าง 10%',
    description: 'ใช้เป็นส่วนลดกับแพ็กเกจล้างรถที่ร่วมรายการ',
    discountType: 'percent',
    discount: 10,
    minSpend: 99,
    validDays: 14,
    rarity: 'standard',
    valueLabel: 'ลด 10%',
    weight: 45,
  },
  {
    rewardId: 'save20b',
    title: 'ลดค่าล้างทันที 20 บาท',
    description: 'ใช้ได้เมื่อมียอดค่าบริการตั้งแต่ 99 บาท',
    discountType: 'amount',
    discount: 20,
    minSpend: 99,
    validDays: 14,
    rarity: 'standard',
    valueLabel: 'ลด ฿20',
    weight: 30,
  },
  {
    rewardId: 'save20',
    title: 'ส่วนลดค่าล้าง 20%',
    description: 'ใช้เป็นส่วนลดเมื่อเลือกแพ็กเกจที่ร่วมรายการ',
    discountType: 'percent',
    discount: 20,
    minSpend: 149,
    validDays: 14,
    rarity: 'shine',
    valueLabel: 'ลด 20%',
    weight: 18,
  },
  {
    rewardId: 'save50b',
    title: 'ลดค่าล้างทันที 50 บาท',
    description: 'คูปองระดับ Signature สำหรับบริการที่ร่วมรายการ',
    discountType: 'amount',
    discount: 50,
    minSpend: 149,
    validDays: 21,
    rarity: 'signature',
    valueLabel: 'ลด ฿50',
    weight: 7,
  },
];

function toPublicPrize(prize: WeightedPrize): RewardPackPrize {
  return {
    rewardId: prize.rewardId,
    title: prize.title,
    description: prize.description,
    discountType: prize.discountType,
    discount: prize.discount,
    minSpend: prize.minSpend,
    validDays: prize.validDays,
    rarity: prize.rarity,
    valueLabel: prize.valueLabel,
  };
}

function choosePrize(): RewardPackPrize {
  const totalWeight = PRIZE_POOL.reduce((total, prize) => total + prize.weight, 0);
  let cursor = Math.random() * totalWeight;
  const picked = PRIZE_POOL.find((prize) => {
    cursor -= prize.weight;
    return cursor <= 0;
  }) ?? PRIZE_POOL[0];
  return toPublicPrize(picked);
}

function writeHistory(history: RewardPackOpening[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
}

export function getRewardPackHistory(): RewardPackOpening[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getRewardPackPrizes(): RewardPackPrize[] {
  return PRIZE_POOL.map(toPublicPrize);
}

export function openLocalRewardPack(): RewardPackOpening | null {
  if (!spendPoints(REWARD_PACK_COST, 'เปิดซอง Reward ROBOSS')) return null;

  try {
    const prize = choosePrize();
    const coupon = grantLocalRewardCoupon(prize);
    const opening: RewardPackOpening = {
      id: `reward_opening_${Date.now()}`,
      prize,
      couponCode: coupon.code,
      openedAt: new Date().toISOString(),
    };
    writeHistory([opening, ...getRewardPackHistory()]);
    return opening;
  } catch (error) {
    creditPoints(REWARD_PACK_COST, 'คืนพอยท์จากการเปิดซองไม่สำเร็จ');
    throw error;
  }
}
