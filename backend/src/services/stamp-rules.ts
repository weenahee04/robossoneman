export const STAMP_TARGET_COUNT = 10;
export const STAMP_REWARD_VALID_DAYS = 90;

export function getStampEarnCount(packageId: string) {
  const normalized = packageId.toLowerCase();

  if (normalized.includes('special')) return 3;
  if (normalized.includes('shine')) return 2;
  if (normalized.includes('quick')) return 1;

  return 0;
}

export function getStampRewardValidUntil(from = new Date()) {
  const validUntil = new Date(from);
  validUntil.setDate(validUntil.getDate() + STAMP_REWARD_VALID_DAYS);
  return validUntil;
}
