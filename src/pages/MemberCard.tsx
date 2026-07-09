import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import fireAnimation from '../Fire.json';
import stoneAnimation from '../Stone.json';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getIconUrl, type IconName } from '../services/icons';
import { listenToUser, formatPoints } from '../services/points';
import { STAMP_TARGET_COUNT, addLocalStamps, readLocalStampCount, writeLocalStampCount } from '../services/stamps';
import type { User as MockUser } from '../services/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory, useStamps, usePointsBalance, useMembership } from '@/hooks/useApi';
import { HAS_API_BASE_URL, USE_LOCAL_DEV_FALLBACK } from '@/lib/runtime';
import type { MembershipOverview, MembershipPlan } from '@/types';

const ICONS8_BASE = 'https://img.icons8.com/?format=png&size=';

function Ico({ id, size = 20, className = '' }: { id: string | number; size?: number; className?: string }) {
  return <img src={`${ICONS8_BASE}${size * 2}&id=${id}`} width={size} height={size} alt="" className={`inline-block flex-shrink-0 ${className}`} style={{ filter: 'invert(1) brightness(1.1)' }} loading="lazy" />;
}

function I8Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <img src={getIconUrl(name, size * 2)} alt={name} width={size} height={size} className={`inline-block ${className}`} style={{ filter: 'invert(1) brightness(1.1)' }} />;
}

function IconBox({ id, size = 14, boxSize = 'w-9 h-9' }: { id: string | number; size?: number; boxSize?: string }) {
  return (
    <div className={`${boxSize} rounded-xl bg-black border border-white/10 flex items-center justify-center flex-shrink-0`}>
      <Ico id={id} size={size} />
    </div>
  );
}

const TOTAL_STAMPS = STAMP_TARGET_COUNT;
const GRAPHENE_MEMBERSHIP_STORAGE_KEY = 'roboss_graphene_membership_active';
const DEFAULT_MEMBER_PLAN_CODE = 'GRAPHENE_MEMBERSHIP';

const memberTiers = [
  { name: 'Bronze', min: 0, max: 5000 },
  { name: 'Silver', min: 5000, max: 15000 },
  { name: 'Gold', min: 15000, max: 50000 },
  { name: 'Platinum', min: 50000, max: 999999 },
];

const benefits = [
  { icon: 12394, title: 'ส่วนลดพิเศษ', sub: 'คูปองส่วนลดทุกเดือน' },
  { icon: 6703, title: 'พ้อยท์ x2', sub: 'ทุกวันอังคาร' },
  { icon: 338, title: 'ของขวัญวันเกิด', sub: 'รับฟรีทุกปี' },
  { icon: 25107, title: 'ล้างรถฟรี', sub: 'สะสมครบ 10 แสตมป์' },
];

const fallbackTransactions = [
  { id: 1, service: 'SHINE MODE', branch: 'สาขาลาดพร้าว', date: '28 มี.ค.', points: '+1,490', iconId: 25107 },
  { id: 2, service: 'SPECIAL MODE', branch: 'สาขาสุขุมวิท', date: '15 มี.ค.', points: '+3,990', iconId: 25107 },
  { id: 3, service: 'QUICK & CLEAN', branch: 'สาขาบางนา', date: '10 มี.ค.', points: '+990', iconId: 25107 },
];

const localMemberPlans: MembershipPlan[] = [
  {
    id: 'plan_graphene_1290',
    code: DEFAULT_MEMBER_PLAN_CODE,
    name: 'ROBOSS Graphene Bundle',
    headline: '10 Washes + 2 Graphene Shield',
    description: '10 washes, 2x Graphene Shield, free vacuum, VIP Fast Lane',
    price: 1290,
    currency: 'THB',
    washLimit: 10,
    grapheneLimit: 2,
    freeVacuumPerVisit: true,
    vipFastLane: true,
    group: 'best_seller',
    groupLabel: 'Best Seller',
    termLabel: 'Valid 12 months',
    badge: 'Best conversion',
    sortOrder: 1,
  },
  {
    id: 'plan_quick_pass_777',
    code: 'QUICK_PASS_777',
    name: 'Quick Pass 777',
    headline: 'Unlimited Quick Wash',
    description: 'Fair-use 30 Quick washes per month',
    price: 777,
    currency: 'THB',
    washLimit: 30,
    grapheneLimit: 0,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    badge: 'Traffic driver',
    sortOrder: 2,
  },
  {
    id: 'plan_black_card_1499',
    code: 'BLACK_CARD_1499',
    name: 'ROBOSS Black Card',
    headline: 'Quick + Vacuum + Priority',
    description: 'Premium monthly active member card',
    price: 1499,
    currency: 'THB',
    washLimit: 30,
    grapheneLimit: 0,
    freeVacuumPerVisit: true,
    vipFastLane: true,
    group: 'membership',
    groupLabel: 'Monthly Membership',
    termLabel: 'Monthly',
    badge: 'VIP',
    sortOrder: 3,
  },
  {
    id: 'plan_buy_10_get_2_999',
    code: 'BUY_10_GET_2_999',
    name: 'Buy 10 Get 2',
    headline: '12 wash credits',
    description: 'Prepaid bundle for repeat customers',
    price: 999,
    currency: 'THB',
    washLimit: 12,
    grapheneLimit: 0,
    freeVacuumPerVisit: false,
    vipFastLane: false,
    group: 'bundle',
    groupLabel: 'Prepaid Bundle',
    termLabel: 'Valid 6 months',
    badge: 'Bundle',
    sortOrder: 7,
  },
];

function buildPlanBenefits(plan: MembershipPlan, active: boolean) {
  return [
    {
      key: 'washes',
      title: `${plan.washLimit} Washes`,
      description: plan.washLimit > 0 ? 'Wash credits unlocked after activation' : 'No wash credits',
      used: 0,
      limit: plan.washLimit,
      remaining: active ? plan.washLimit : 0,
      enabled: active && plan.washLimit > 0,
    },
    {
      key: 'graphene_shield',
      title: `${plan.grapheneLimit}x Graphene`,
      description: plan.grapheneLimit > 0 ? 'Graphene Shield upgrade credits' : 'No Graphene credits',
      used: 0,
      limit: plan.grapheneLimit,
      remaining: active ? plan.grapheneLimit : 0,
      enabled: active && plan.grapheneLimit > 0,
    },
    {
      key: 'free_vacuum',
      title: 'Free Vacuum',
      description: 'Included every eligible visit',
      used: 0,
      limit: plan.washLimit || null,
      remaining: active ? plan.washLimit : 0,
      enabled: active && plan.freeVacuumPerVisit,
    },
    {
      key: 'vip_fast_lane',
      title: 'VIP Fast Lane',
      description: 'Priority service queue',
      used: 0,
      limit: null,
      remaining: null,
      enabled: active && plan.vipFastLane,
    },
  ];
}

function buildLocalMembershipOverview(activePlanCodes: string[]): MembershipOverview {
  const now = new Date().toISOString();
  const plans = localMemberPlans.map((plan) => {
    const active = activePlanCodes.includes(plan.code);
    return {
      ...plan,
      active,
      benefits: buildPlanBenefits(plan, active),
      membership: active
        ? {
            id: `local_${plan.code.toLowerCase()}`,
            status: 'active' as const,
            washUsed: 0,
            grapheneUsed: 0,
            washRemaining: plan.washLimit,
            grapheneRemaining: plan.grapheneLimit,
            paymentAmount: plan.price,
            paymentCurrency: plan.currency,
            paymentStatus: 'local_confirmed',
            paymentReference: `LOCAL-${plan.code}`,
            activatedAt: now,
            expiresAt: null,
            cancelledAt: null,
            lastUsedAt: null,
            createdAt: now,
            updatedAt: now,
          }
        : null,
    };
  });
  const featured = plans.find((plan) => plan.code === DEFAULT_MEMBER_PLAN_CODE) ?? plans[0];

  return {
    plan: featured,
    membership: featured.membership ?? null,
    active: Boolean(featured.active),
    benefits: featured.benefits ?? [],
    plans,
    memberships: plans.map((plan) => plan.membership).filter(Boolean) as MembershipOverview['memberships'],
    groups: [
      { key: 'best_seller', label: 'Best Seller', description: 'ตัวหลักที่ขายง่ายและคุม margin ได้ดี' },
      { key: 'membership', label: 'Monthly Membership', description: 'รายได้ประจำและสิทธิ์ active member' },
      { key: 'bundle', label: 'Prepaid Bundle', description: 'เติมเงินล่วงหน้า ใช้เครดิตเป็นครั้ง' },
    ],
  };
}

export function MemberCard({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const sessionHistoryQuery = useSessionHistory();
  const { data: apiStamps } = useStamps();
  const { data: apiPoints } = usePointsBalance();
  const { data: apiMembership } = useMembership(Boolean(authUser));
  const [mockUser, setMockUser] = useState<MockUser | null>(null);
  const [localActivePlanCodes] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem(GRAPHENE_MEMBERSHIP_STORAGE_KEY);
    if (stored === 'true') return [DEFAULT_MEMBER_PLAN_CODE];
    try {
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });

  const [stamps, setStamps] = useState<number>(readLocalStampCount);
  const [animating, setAnimating] = useState<number | null>(null);
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    if (USE_LOCAL_DEV_FALLBACK) {
      const unsub = listenToUser(setMockUser);
      return unsub;
    }
  }, []);

  const user = useMemo(() => {
    if (HAS_API_BASE_URL && authUser) {
      return {
        displayName: authUser.displayName,
        avatarUrl: authUser.avatarUrl,
        points: apiPoints?.balance ?? authUser.totalPoints,
        totalWashes: authUser.totalWashes,
        memberSince: new Date(authUser.memberSince),
      } as MockUser;
    }
    return mockUser;
  }, [authUser, mockUser, apiPoints]);

  useEffect(() => {
    if (HAS_API_BASE_URL && apiStamps) {
      setStamps(apiStamps.currentCount);
    }
  }, [apiStamps]);

  useEffect(() => {
    if (USE_LOCAL_DEV_FALLBACK) {
      writeLocalStampCount(stamps);
    }
    if (stamps >= TOTAL_STAMPS) setTimeout(() => setShowReward(true), 400);
  }, [stamps]);

  const addStamp = () => {
    if (!USE_LOCAL_DEV_FALLBACK) return;
    if (stamps >= TOTAL_STAMPS) return;
    const { total } = addLocalStamps('quick');
    setAnimating(total - 1);
    setStamps(total);
    setTimeout(() => setAnimating(null), 800);
  };
  const reset = () => {
    if (!USE_LOCAL_DEV_FALLBACK) return;
    setStamps(writeLocalStampCount(0));
    setShowReward(false);
  };

  const transactions = useMemo(() => {
    if (HAS_API_BASE_URL && sessionHistoryQuery.data?.data) {
      return sessionHistoryQuery.data.data
        .filter((session) => session.status === 'completed')
        .slice(0, 3)
        .map((session) => ({
          id: session.id,
          service: session.package?.name || session.packageId,
          branch: session.branch?.name || session.branchId,
          date: new Date(session.completedAt || session.createdAt).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
          }),
          points: `+${formatPoints(session.pointsEarned)}`,
          iconId: 25107,
        }));
    }

    return USE_LOCAL_DEV_FALLBACK ? fallbackTransactions : [];
  }, [sessionHistoryQuery.data]);

  const membershipOverview = useMemo(() => {
    if (HAS_API_BASE_URL && apiMembership) {
      return apiMembership;
    }
    return buildLocalMembershipOverview(localActivePlanCodes);
  }, [apiMembership, localActivePlanCodes]);

  const membershipPlan = membershipOverview.plan;
  const memberPlans = membershipOverview.plans?.length ? membershipOverview.plans : [membershipPlan];
  const activeMemberPlans = memberPlans.filter((plan) => plan.active || plan.membership?.status === 'active');
  const activeMemberCount = activeMemberPlans.length;
  const activeTotals = activeMemberPlans.reduce(
    (totals, plan) => ({
      washes: totals.washes + (plan.membership?.washRemaining ?? (plan.washLimit || 0)),
      graphene: totals.graphene + (plan.membership?.grapheneRemaining ?? (plan.grapheneLimit || 0)),
      vip: totals.vip || Boolean(plan.vipFastLane),
      vacuum: totals.vacuum || Boolean(plan.freeVacuumPerVisit),
    }),
    { washes: 0, graphene: 0, vip: false, vacuum: false }
  );

  const currentTier = memberTiers.find(t => (user?.points || 0) >= t.min && (user?.points || 0) < t.max) || memberTiers[0];
  const nextTier = memberTiers[memberTiers.indexOf(currentTier) + 1];
  const tierProgress = nextTier ? ((user?.points || 0) - currentTier.min) / (nextTier.min - currentTier.min) * 100 : 100;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } } };

  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-app-black/95 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-white -ml-2">
          <I8Icon name="back" size={20} />
        </Button>
        <h1 className="text-white font-bold text-base">บัตรสมาชิก</h1>
        <div className="w-10" />
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-4 pb-6 space-y-4">

          {/* Platinum Card */}
          <motion.div variants={itemVariants}>
            <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1.586/1' }}>
              {/* Metallic layered background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#2a2a2a] via-[#1a1a1a] to-[#0d0d0d]" />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#3a3a3a]/30 to-transparent" />
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 3px)' }} />

              {/* Red accent glow */}
              <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-app-red/12 rounded-full blur-3xl" />
              <div className="absolute top-0 left-0 w-24 h-24 bg-white/[0.03] rounded-full -ml-8 -mt-8 blur-2xl" />

              {/* Holographic shine sweep */}
              <motion.div
                className="absolute inset-0 -translate-x-full"
                style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 55%, transparent 70%)' }}
                animate={{ translateX: ['-100%', '250%'] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
              />
              {/* Secondary rainbow shimmer */}
              <motion.div
                className="absolute inset-0 -translate-x-full opacity-40"
                style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(200,50,50,0.08) 45%, rgba(255,255,255,0.05) 50%, rgba(200,50,50,0.08) 55%, transparent 65%)' }}
                animate={{ translateX: ['-100%', '250%'] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut', delay: 0.3 }}
              />

              {/* Top metallic edge highlight */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-white/15 via-white/5 to-transparent" />
              <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

              {/* Card content */}
              <div className="relative z-10 p-5 flex flex-col h-full justify-between">
                {/* Top: Logo + Tier */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ background: 'linear-gradient(135deg, #e8e8e8, #a0a0a0, #e8e8e8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ROBOSS</p>
                    <p className="text-[8px] text-white/20 tracking-[0.3em] uppercase mt-0.5 font-medium">Platinum Member</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="px-2.5 py-0.5 rounded bg-gradient-to-r from-white/10 to-white/5 border border-white/10">
                      <span className="text-[9px] font-bold tracking-wider" style={{ background: 'linear-gradient(135deg, #e8e8e8, #b0b0b0, #e8e8e8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{currentTier.name}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Chip + Contactless */}
                <div className="flex items-center gap-3">
                  {/* EMV Chip */}
                  <div className="w-10 h-7 rounded-[3px] overflow-hidden border border-[#8a7a50]/40" style={{ background: 'linear-gradient(145deg, #c9a84c, #a08535, #d4b45c, #a08535)' }}>
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-[0.5px] p-[2px]">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="rounded-[0.5px]" style={{ background: 'linear-gradient(135deg, #d4b860, #b8972e)' }} />
                      ))}
                    </div>
                  </div>
                  {/* Contactless icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-25">
                    <path d="M6.5 12a5.5 5.5 0 0 1 5.5-5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M3 12a9 9 0 0 1 9-9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M10 12a2 2 0 0 1 2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>

                {/* Bottom: Member info + QR */}
                <div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[15px] font-mono tracking-[0.25em] text-white/80 mb-2">RB 2024 0015 8</p>
                      <div>
                        <p className="text-[8px] text-white/20 tracking-wider uppercase mb-0.5">Card Holder</p>
                        <p className="text-sm font-bold tracking-wide" style={{ background: 'linear-gradient(135deg, #f0f0f0, #c0c0c0, #f0f0f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{user?.displayName || 'USER'}</p>
                      </div>
                    </div>
                    {/* QR */}
                    <div className="bg-white p-1.5 rounded-md shadow-lg shadow-black/20">
                      <div className="w-9 h-9 grid grid-cols-5 grid-rows-5 gap-[1px]">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div key={i} className={`rounded-[0.5px] ${[0,1,2,4,5,6,10,12,14,18,20,22,23,24].includes(i) ? 'bg-[#1a1a1a]' : 'bg-gray-300'}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom details row */}
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[7px] text-white/15 tracking-wider uppercase">Valid From</p>
                        <p className="text-[9px] text-white/30 font-mono">01/24</p>
                      </div>
                      <div>
                        <p className="text-[7px] text-white/15 tracking-wider uppercase">Valid Thru</p>
                        <p className="text-[9px] text-white/30 font-mono">12/29</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-app-red/60" />
                      <div className="w-4 h-4 rounded-full bg-white/15 -ml-2" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Active Member Packages */}
          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden border border-white/5 bg-white/[0.03]">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-app-red">Active Member Wallet</p>
                    <h2 className="mt-1 text-lg font-black leading-tight text-white">MY ACTIVE PACKAGES</h2>
                    <p className="mt-1 text-xs text-white/45">
                      {activeMemberCount ? `${activeMemberCount} active package${activeMemberCount > 1 ? 's' : ''}` : 'ยังไม่มีแพ็ก Active ให้ไปซื้อที่หน้าโปรโมชั่นก่อน'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-app-red px-3 py-2 text-right text-white">
                    <p className="text-[10px] font-bold uppercase tracking-wide">Source</p>
                    <p className="text-base font-black">PROMO</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <div className="rounded-xl border border-white/5 bg-black/25 p-2">
                    <p className="text-[9px] font-bold uppercase text-white/25">Packages</p>
                    <p className="mt-1 text-base font-black text-white">{activeMemberCount}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/25 p-2">
                    <p className="text-[9px] font-bold uppercase text-white/25">Wash left</p>
                    <p className="mt-1 text-base font-black text-white">{activeTotals.washes}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/25 p-2">
                    <p className="text-[9px] font-bold uppercase text-white/25">Graphene</p>
                    <p className="mt-1 text-base font-black text-white">{activeTotals.graphene}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/25 p-2">
                    <p className="text-[9px] font-bold uppercase text-white/25">VIP</p>
                    <p className="mt-1 text-base font-black text-white">{activeTotals.vip ? 'ON' : 'OFF'}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {!activeMemberPlans.length && (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-center">
                      <p className="text-sm font-bold text-white/75">ยังไม่มีแพ็กสมาชิก</p>
                      <p className="mt-1 text-xs text-white/35">ซื้อแพ็กจากหน้าโปรโมชั่นก่อน แล้วรายการจะมาแสดงที่นี่เป็น Active</p>
                      <Button
                        type="button"
                        onClick={() => navigate('/promotion')}
                        className="mt-4 h-10 rounded-full bg-app-red px-5 text-xs font-black text-white hover:bg-red-600"
                      >
                        ไปซื้อแพ็กที่โปรโมชั่น
                      </Button>
                    </div>
                  )}

                  {activeMemberPlans.map((plan) => {
                    const planBenefits = plan.benefits ?? buildPlanBenefits(plan, true);
                    const primaryCredit = plan.grapheneLimit > 0 && plan.washLimit === 0
                      ? `Graphene ${plan.membership?.grapheneUsed ?? 0}/${plan.grapheneLimit}`
                      : `Wash ${plan.membership?.washUsed ?? 0}/${plan.washLimit}`;

                    return (
                      <div
                        key={plan.code}
                        className="rounded-2xl border border-app-red/30 bg-gradient-to-br from-[#170607] via-[#101010] to-black p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-app-red px-2 py-0.5 text-[9px] font-black uppercase text-white">
                                ACTIVE
                              </span>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-white/60">
                                {plan.groupLabel || plan.group}
                              </span>
                              {plan.badge && <span className="text-[9px] font-bold uppercase tracking-wide text-app-red">{plan.badge}</span>}
                            </div>
                            <h3 className="mt-2 text-sm font-black text-white">{plan.name}</h3>
                            <p className="mt-0.5 text-xs text-white/50">{plan.headline || plan.description}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-black text-white">{plan.price.toLocaleString()}</p>
                            <p className="text-[9px] font-bold uppercase text-white/25">THB</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {planBenefits.map((benefit) => {
                            const hasMeter = benefit.limit !== null && benefit.limit > 0;
                            const value = hasMeter ? `${benefit.used}/${benefit.limit}` : benefit.enabled ? 'ON' : 'OFF';
                            const percent = hasMeter && benefit.limit ? Math.min((benefit.used / benefit.limit) * 100, 100) : 0;

                            return (
                              <div key={benefit.key} className={`rounded-xl border p-2 ${benefit.enabled ? 'border-app-red/20 bg-app-red/10' : 'border-white/5 bg-black/20'}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`truncate text-[10px] font-bold ${benefit.enabled ? 'text-white' : 'text-white/25'}`}>{benefit.title}</p>
                                  <span className={`shrink-0 text-[10px] font-black ${benefit.enabled ? 'text-app-red' : 'text-white/20'}`}>{value}</span>
                                </div>
                                {hasMeter && (
                                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                                    <div className={`h-full rounded-full ${benefit.enabled ? 'bg-app-red' : 'bg-white/10'}`} style={{ width: `${percent}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 text-[10px] text-white/35">
                            {`${primaryCredit} · ${plan.termLabel || 'Active'}`}
                          </div>
                          <Button
                            disabled
                            className="h-9 rounded-full bg-white/10 px-4 text-[10px] font-black text-white/45"
                          >
                            ACTIVE
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </Card>
          </motion.div>

          {/* Points + Tier */}
          <motion.div variants={itemVariants}>
            <Card className="p-4 border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0 -my-2">
                    <Lottie animationData={stoneAnimation} loop className="w-full h-full" />
                  </div>
                  <div>
                    <p className="text-white font-black text-xl leading-none">{user ? formatPoints(user.points) : '0'}</p>
                    <p className="text-white/30 text-[10px]">พ้อยท์สะสม</p>
                  </div>
                </div>
                {nextTier && (
                  <div className="text-right">
                    <p className="text-white/40 text-[10px]">ถึง {nextTier.name}</p>
                    <p className="text-app-red text-xs font-bold">{formatPoints(nextTier.min - (user?.points || 0))} pt</p>
                  </div>
                )}
              </div>
              {/* Progress */}
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-app-red rounded-full transition-all duration-500" style={{ width: `${tierProgress}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-white/25">{currentTier.name}</span>
                {nextTier && <span className="text-[9px] text-white/25">{nextTier.name}</span>}
              </div>
            </Card>
          </motion.div>

          {/* Stamp Collection */}
          <motion.div variants={itemVariants}>
            <Card className="p-4 border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <IconBox id={39070} size={14} boxSize="w-8 h-8" />
                  <div>
                    <p className="text-white font-bold text-sm">สะสมแสตมป์</p>
                    <p className="text-white/25 text-[10px]">ล้าง {TOTAL_STAMPS} ครั้ง รับฟรี 1 ครั้ง</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-app-red/30 text-app-red">{stamps}/{TOTAL_STAMPS}</Badge>
              </div>

              {/* Stamp grid */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                {Array.from({ length: TOTAL_STAMPS }).map((_, i) => {
                  const collected = i < stamps;
                  return (
                    <div
                      key={i}
                      className={`relative aspect-square rounded-xl flex items-center justify-center transition-all duration-300 ${
                        collected
                          ? 'bg-app-red/15 border border-app-red/25'
                          : 'bg-white/[0.02] border border-dashed border-white/10'
                      } ${animating === i ? 'scale-110' : ''}`}
                    >
                      {collected
                        ? <Lottie animationData={fireAnimation} loop className="w-full h-full p-1" />
                        : <span className="text-xs font-black text-white/10">{i + 1}</span>
                      }
                    </div>
                  );
                })}
              </div>

              {/* Reward row */}
              <div className={`flex items-center gap-3 rounded-xl p-3 border ${
                stamps === TOTAL_STAMPS ? 'bg-app-red/10 border-app-red/25' : 'bg-white/[0.02] border-white/5'
              }`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  stamps === TOTAL_STAMPS ? 'bg-app-red' : 'bg-black border border-white/10'
                }`}>
                  <Ico id={25107} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${stamps === TOTAL_STAMPS ? 'text-white' : 'text-white/30'}`}>ล้างรถฟรี 1 ครั้ง</p>
                  <p className="text-[10px] text-white/20">สะสมครบ {TOTAL_STAMPS} แสตมป์</p>
                </div>
                {stamps === TOTAL_STAMPS && (
                  <Button size="sm" className="bg-app-red hover:bg-red-600 rounded-full text-xs h-7 px-3">รับเลย</Button>
                )}
              </div>

              <Button variant="secondary" onClick={addStamp} disabled={!USE_LOCAL_DEV_FALLBACK || stamps >= TOTAL_STAMPS} className="w-full mt-3 text-xs h-9">
                {stamps >= TOTAL_STAMPS ? 'สะสมแสตมป์ครบแล้ว' : '+ จำลองเพิ่มแสตมป์'}
              </Button>
            </Card>
          </motion.div>

          {/* Benefits */}
          <motion.div variants={itemVariants}>
            <Card className="p-4 border-white/5">
              <div className="flex items-center gap-2.5 mb-3">
                <IconBox id={12566} size={14} boxSize="w-8 h-8" />
                <p className="text-white font-bold text-sm">สิทธิพิเศษสมาชิก</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/[0.02] rounded-xl p-2.5 border border-white/5">
                    <div className="w-7 h-7 rounded-lg bg-app-red/10 border border-app-red/15 flex items-center justify-center flex-shrink-0">
                      <Ico id={b.icon} size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-[11px] font-bold truncate">{b.title}</p>
                      <p className="text-white/20 text-[9px] truncate">{b.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Recent Transactions */}
          <motion.div variants={itemVariants}>
            <Card className="p-0 overflow-hidden border-white/5">
              <div className="flex items-center justify-between p-4 pb-0">
                <div className="flex items-center gap-2.5">
                  <IconBox id={2294} size={14} boxSize="w-8 h-8" />
                  <p className="text-white font-bold text-sm">ล้างรถล่าสุด</p>
                </div>
              </div>
              <div className="p-4 pt-3 space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-app-red/10 border border-app-red/15 flex items-center justify-center flex-shrink-0">
                      <Ico id={tx.iconId} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[12px] font-bold truncate">{tx.service}</p>
                      <p className="text-white/25 text-[10px]">{tx.branch} • {tx.date}</p>
                    </div>
                    <span className="text-app-red text-xs font-bold flex-shrink-0">{tx.points}</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}
