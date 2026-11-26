// Points / Loyalty Service
import { mockUser, POINTS_RATE, type User } from './mockData';

const POINTS_BALANCE_KEY = 'roboss_local_points_balance';

function readStoredPoints(): number {
  if (typeof window === 'undefined') return mockUser.points;
  try {
    const raw = window.localStorage.getItem(POINTS_BALANCE_KEY);
    if (raw === null) return mockUser.points;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored >= 0 ? stored : mockUser.points;
  } catch {
    return mockUser.points;
  }
}

function persistPoints() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POINTS_BALANCE_KEY, String(currentUser.points));
  } catch {
    // Browsers that block storage still keep the in-memory balance for this session.
  }
}

// Local loyalty state. The balance persists so reward-pack spending survives refreshes.
const currentUser: User = { ...mockUser, points: readStoredPoints() };
const pointsHistory: { id: string; amount: number; reason: string; sessionId: string; createdAt: Date }[] = [
  { id: 'ph_001', amount: 1090, reason: 'QUICK & CLEAN ไซส์ M — สาขาลาดพร้าว', sessionId: 'old_1', createdAt: new Date('2025-12-20') },
  { id: 'ph_002', amount: 1490, reason: 'SHINE MODE ไซส์ M — สาขาบางนา', sessionId: 'old_2', createdAt: new Date('2026-01-05') },
  { id: 'ph_003', amount: -500, reason: 'แลกส่วนลด 50 บาท', sessionId: '', createdAt: new Date('2026-01-10') },
  { id: 'ph_004', amount: 3990, reason: 'SPECIAL MODE ไซส์ M — สาขาลาดพร้าว', sessionId: 'old_3', createdAt: new Date('2026-02-14') },
];

const listeners: ((user: User) => void)[] = [];

function notifyListeners() {
  listeners.forEach(cb => cb({ ...currentUser }));
}

export function getUser(): User {
  return { ...currentUser };
}

export function getUserPoints(): number {
  return currentUser.points;
}

export function addPoints(amount: number, reason: string, sessionId = ''): void {
  currentUser.points += amount;
  currentUser.totalWashes += 1;
  pointsHistory.unshift({
    id: 'ph_' + Date.now(),
    amount,
    reason,
    sessionId,
    createdAt: new Date(),
  });
  persistPoints();
  notifyListeners();
}

export function spendPoints(amount: number, reason: string): boolean {
  if (!Number.isFinite(amount) || amount <= 0 || currentUser.points < amount) return false;
  currentUser.points -= amount;
  pointsHistory.unshift({
    id: 'ph_' + Date.now(),
    amount: -amount,
    reason,
    sessionId: '',
    createdAt: new Date(),
  });
  persistPoints();
  notifyListeners();
  return true;
}

export function creditPoints(amount: number, reason: string): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  currentUser.points += amount;
  pointsHistory.unshift({
    id: 'ph_' + Date.now(),
    amount,
    reason,
    sessionId: '',
    createdAt: new Date(),
  });
  persistPoints();
  notifyListeners();
}

export function getPointsHistory() {
  return [...pointsHistory];
}

export function calculatePoints(totalPrice: number): number {
  return totalPrice * POINTS_RATE;
}

export function listenToUser(callback: (user: User) => void): () => void {
  listeners.push(callback);
  callback({ ...currentUser });
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

export function formatPoints(points: number): string {
  return points.toLocaleString('th-TH');
}
