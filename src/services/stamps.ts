export const STAMP_TARGET_COUNT = 10;
export const STAMP_STORAGE_KEY = 'roboss_stamps';

export const STAMP_EARN_RULES = [
  { packageKey: 'quick', label: 'Quick & Clean Mode', stamps: 1 },
  { packageKey: 'shine', label: 'Shine Mode', stamps: 2 },
  { packageKey: 'special', label: 'Special Mode', stamps: 3 },
  { packageKey: 'vacuum', label: 'Interior Vacuum', stamps: 0 },
] as const;

export function getStampEarnCount(packageIdOrName: string) {
  const normalized = packageIdOrName.toLowerCase();

  if (normalized.includes('special')) return 3;
  if (normalized.includes('shine')) return 2;
  if (normalized.includes('quick')) return 1;

  return 0;
}

export function readLocalStampCount() {
  const saved = localStorage.getItem(STAMP_STORAGE_KEY);
  const parsed = saved ? Number.parseInt(saved, 10) : 0;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, STAMP_TARGET_COUNT)) : 0;
}

export function writeLocalStampCount(count: number) {
  const next = Math.max(0, Math.min(count, STAMP_TARGET_COUNT));
  localStorage.setItem(STAMP_STORAGE_KEY, String(next));
  return next;
}

export function addLocalStamps(packageIdOrName: string) {
  const earned = getStampEarnCount(packageIdOrName);
  if (earned <= 0) {
    return { earned, total: readLocalStampCount() };
  }

  const total = writeLocalStampCount(readLocalStampCount() + earned);
  return { earned, total };
}
