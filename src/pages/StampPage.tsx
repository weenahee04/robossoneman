import React, { useEffect, useMemo, useState } from 'react';
import Lottie from 'lottie-react';
import fireAnimation from '../Fire.json';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getIconUrl, type IconName } from '../services/icons';
import { useStamps, useClaimStampReward } from '@/hooks/useApi';
import { HAS_API_BASE_URL, USE_LOCAL_DEV_FALLBACK } from '@/lib/runtime';
import {
  STAMP_EARN_RULES,
  STAMP_TARGET_COUNT,
  addLocalStamps,
  readLocalStampCount,
  writeLocalStampCount,
} from '@/services/stamps';

function I8Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <img
      src={getIconUrl(name, size * 2)}
      alt={name}
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ filter: 'invert(1) brightness(1.1)' }}
      draggable={false}
    />
  );
}

export function StampPage({ onBack }: { onBack: () => void }) {
  const [localStamps, setLocalStamps] = useState(readLocalStampCount);
  const [animating, setAnimating] = useState<number | null>(null);
  const [showReward, setShowReward] = useState(false);

  const stampsQuery = useStamps();
  const claimRewardMutation = useClaimStampReward();

  const stamps = useMemo(() => {
    if (HAS_API_BASE_URL && stampsQuery.data?.currentCount != null) {
      return stampsQuery.data.currentCount;
    }
    return localStamps;
  }, [stampsQuery.data, localStamps]);

  const totalTarget = useMemo(() => {
    if (HAS_API_BASE_URL && stampsQuery.data?.targetCount) {
      return stampsQuery.data.targetCount;
    }
    return STAMP_TARGET_COUNT;
  }, [stampsQuery.data]);

  const rewardClaimed = useMemo(() => {
    if (HAS_API_BASE_URL && stampsQuery.data) {
      return stampsQuery.data.rewardClaimed;
    }
    return false;
  }, [stampsQuery.data]);

  const isRewardReady = stamps >= totalTarget && !rewardClaimed;
  const progressPercent = Math.min(100, (stamps / totalTarget) * 100);

  useEffect(() => {
    if (USE_LOCAL_DEV_FALLBACK) {
      writeLocalStampCount(localStamps);
    }
    if (isRewardReady) {
      const timer = window.setTimeout(() => setShowReward(true), 300);
      return () => window.clearTimeout(timer);
    }
    setShowReward(false);
  }, [isRewardReady, localStamps]);

  const addStampForDemo = (packageKey: string) => {
    if (!USE_LOCAL_DEV_FALLBACK || localStamps >= totalTarget) return;

    const before = readLocalStampCount();
    const { total } = addLocalStamps(packageKey);
    setLocalStamps(total);
    if (total > before) {
      setAnimating(Math.min(total, totalTarget) - 1);
      window.setTimeout(() => setAnimating(null), 800);
    }
  };

  const reset = () => {
    if (!USE_LOCAL_DEV_FALLBACK) return;
    setLocalStamps(writeLocalStampCount(0));
    setShowReward(false);
  };

  const claimReward = async () => {
    if (!isRewardReady) return;

    if (HAS_API_BASE_URL) {
      await claimRewardMutation.mutateAsync();
      return;
    }

    setLocalStamps(writeLocalStampCount(0));
    setShowReward(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden">
      <div className="sticky top-0 z-50 bg-app-black/95 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-white">
          <I8Icon name="back" size={20} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white">สะสมแสตมป์</h1>
          <p className="text-[10px] text-gray-400">ครบ 10 ดวง รับคูปองล้างรถฟรี 1 ครั้ง</p>
        </div>
        <Button variant="ghost" size="icon" onClick={reset} disabled={!USE_LOCAL_DEV_FALLBACK} className="text-gray-400">
          <I8Icon name="refresh" size={15} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5 space-y-4">
        <section className="rounded-2xl overflow-hidden border border-app-red/40 bg-black">
          <div className="p-4 bg-gradient-to-r from-black via-[#171717] to-app-red/30 border-b border-app-red/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.24em] text-white/45 font-bold">ROBOSS</p>
                <h2 className="text-2xl font-black text-white leading-tight mt-1">STAMP COUPON</h2>
                <p className="text-app-red text-sm font-black mt-1">10 STAMPS GET 1 FREE</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                <I8Icon name="carService" size={28} />
              </div>
            </div>
          </div>

          <div className="bg-white p-4">
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: totalTarget }).map((_, i) => {
                const collected = i < stamps;
                const isNew = animating === i;
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                      collected
                        ? 'border-app-red bg-app-red/10 shadow-[0_0_14px_rgba(220,38,38,0.25)]'
                        : 'border-black/70 bg-white'
                    } ${isNew ? 'scale-110' : 'scale-100'}`}
                  >
                    {collected ? (
                      <Lottie animationData={fireAnimation} loop className="w-full h-full p-1" />
                    ) : (
                      <span className="text-2xl font-black text-black/30">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={`mt-3 rounded-xl border-2 p-3 flex items-center gap-3 ${
              isRewardReady ? 'border-app-red bg-app-red text-white' : 'border-app-red/50 bg-white text-app-red'
            }`}>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isRewardReady ? 'bg-white/15' : 'bg-app-red'
              }`}>
                <I8Icon name="gift" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black leading-none">FREE</p>
                <p className="text-xs font-bold mt-1">1 FREE WASH</p>
              </div>
              <Badge className={isRewardReady ? 'bg-white text-app-red' : 'bg-app-red text-white'}>
                {stamps}/{totalTarget}
              </Badge>
            </div>
          </div>
        </section>

        <Card className="p-4 border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white">ความคืบหน้า</span>
            <span className="text-sm font-black text-yellow-400">{stamps} / {totalTarget}</span>
          </div>
          <div className="w-full h-2 bg-black rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-app-red to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Card>

        <Card className="p-4 border-white/5">
          <p className="text-sm font-bold text-white mb-3">วิธีรับแสตมป์</p>
          <div className="space-y-2">
            {STAMP_EARN_RULES.map((rule) => (
              <div key={rule.packageKey} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{rule.label}</p>
                  <p className="text-[10px] text-white/35">
                    {rule.stamps > 0 ? `รับ ${rule.stamps} แสตมป์ / 1 ใบเสร็จ` : 'ไม่มีแสตมป์สำหรับบริการนี้'}
                  </p>
                </div>
                <Badge className={rule.stamps > 0 ? 'bg-app-red text-white' : 'bg-white/10 text-white/45'}>
                  {rule.stamps > 0 ? `${rule.stamps} stamp` : 'no stamp'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {showReward ? (
          <Card className="p-4 border-app-red/40 bg-app-red/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-app-red flex items-center justify-center">
                <I8Icon name="gift" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-black">ครบ 10 แสตมป์แล้ว</p>
                <p className="text-white/45 text-[11px]">กดรับเพื่อออกคูปองล้างรถฟรี 1 ครั้ง</p>
              </div>
            </div>
            <Button
              onClick={() => void claimReward()}
              disabled={claimRewardMutation.isPending}
              className="w-full mt-3 bg-app-red hover:bg-red-700"
            >
              {claimRewardMutation.isPending ? 'กำลังรับรางวัล...' : 'รับคูปองฟรีวอช'}
            </Button>
          </Card>
        ) : null}

        {USE_LOCAL_DEV_FALLBACK ? (
          <Card className="p-4 border-white/5">
            <p className="text-sm font-bold text-white mb-3">จำลองการล้างรถ</p>
            <div className="grid grid-cols-3 gap-2">
              {STAMP_EARN_RULES.filter((rule) => rule.stamps > 0).map((rule) => (
                <Button
                  key={rule.packageKey}
                  variant="secondary"
                  onClick={() => addStampForDemo(rule.packageKey)}
                  disabled={stamps >= totalTarget}
                  className="h-10 text-xs"
                >
                  +{rule.stamps} {rule.packageKey}
                </Button>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="p-4 border-white/5">
          <p className="text-sm font-bold text-white mb-3">เงื่อนไข</p>
          <div className="space-y-2 text-xs text-white/50">
            <p>1 แสตมป์ต่อ 1 บริการ / 1 ใบเสร็จ ตามโหมดที่เลือก</p>
            <p>แสตมป์ต้องเก็บในวันที่ใช้บริการ และไม่สามารถแลกเป็นเงินสดได้</p>
            <p>คูปองล้างฟรีใช้ได้ 1 ครั้ง และเป็นสิทธิ์เฉพาะบัญชีสมาชิกนี้</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
