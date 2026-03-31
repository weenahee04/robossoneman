import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { getIconUrl, type IconName } from '../services/icons';
import { formatPoints } from '../services/points';
import { useReferralInfo } from '@/hooks/useApi';

const USE_API = !!import.meta.env.VITE_API_URL;

function I8Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <img src={getIconUrl(name, size * 2)} alt={name} width={size} height={size} className={`inline-block ${className}`} style={{ filter: 'invert(1) brightness(1.1)' }} />;
}

const referralCode = 'ROBOSS-W2026';
const referralStats = { invited: 3, target: 5, earned: 3750 };
const referralHistory = [
  { id: '1', name: 'คุณ A', date: '25 มี.ค. 2026', points: 1250, status: 'completed' },
  { id: '2', name: 'คุณ B', date: '20 มี.ค. 2026', points: 1250, status: 'completed' },
  { id: '3', name: 'คุณ C', date: '15 มี.ค. 2026', points: 1250, status: 'completed' },
];

const milestones = [
  { count: 1, reward: '500 คะแนน', done: true },
  { count: 3, reward: 'คูปองลด 50 บาท', done: true },
  { count: 5, reward: 'ล้างรถฟรี 1 ครั้ง!', done: false },
  { count: 10, reward: 'เสื้อ ROBOSS', done: false },
];

export function ReferralPage({ onBack }: { onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const referralQuery = useReferralInfo();

  const activeCode = useMemo(() => {
    if (USE_API && referralQuery.data?.code) return referralQuery.data.code;
    return referralCode;
  }, [referralQuery.data]);

  const activeStats = useMemo(() => {
    if (USE_API && referralQuery.data) {
      return {
        invited: referralQuery.data.count,
        target: referralStats.target,
        earned: referralQuery.data.pointsEarned,
      };
    }
    return referralStats;
  }, [referralQuery.data]);

  const copyCode = () => {
    navigator.clipboard?.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = (activeStats.invited / activeStats.target) * 100;
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-app-black/95 sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-white -ml-2">
          <I8Icon name="back" size={20} />
        </Button>
        <h1 className="text-white font-bold text-lg">ชวนเพื่อน</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="px-4 py-5 space-y-4">
          {/* Hero Card */}
          <motion.div variants={itemVariants}>
            <Card className="p-5 bg-gradient-to-br from-app-red/30 to-orange-900/20 border-app-red/30 text-center">
              <div className="w-16 h-16 rounded-full bg-app-red/20 flex items-center justify-center mx-auto mb-3">
                <I8Icon name="people" size={30} />
              </div>
              <h2 className="text-white text-lg font-black mb-1">ชวนเพื่อนมาล้างรถ</h2>
              <p className="text-gray-300 text-xs">ชวนเพื่อนสมัครและล้างรถ รับคะแนนทั้งคู่!</p>
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                <div className="bg-app-black/60 rounded-xl px-4 py-2.5 flex items-center gap-2 border border-white/10 min-w-0">
                  <span className="text-white font-mono font-bold text-sm tracking-wider truncate">{activeCode}</span>
                </div>
                <Button size="sm" onClick={copyCode} className="h-10 flex-shrink-0">
                  {copied ? <I8Icon name="checkmark" size={16} /> : <I8Icon name="copy" size={16} />}
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-xl font-black text-white">{activeStats.invited}</p>
              <p className="text-[10px] text-gray-400">เพื่อนที่ชวน</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xl font-black text-yellow-400">{formatPoints(activeStats.earned)}</p>
              <p className="text-[10px] text-gray-400">คะแนนที่ได้</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xl font-black text-green-400">{activeStats.target - activeStats.invited}</p>
              <p className="text-[10px] text-gray-400">อีกกี่คน</p>
            </Card>
          </motion.div>

          {/* Progress to next reward */}
          <motion.div variants={itemVariants}>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">เป้าหมายถัดไป</span>
                <span className="text-xs text-white font-bold">{activeStats.invited}/{activeStats.target} คน</span>
              </div>
              <Progress value={progress} className="h-2 mb-2" />
              <p className="text-[11px] text-gray-500">ชวนอีก {activeStats.target - activeStats.invited} คน รับ <span className="text-yellow-400 font-bold">ล้างรถฟรี!</span></p>
            </Card>
          </motion.div>

          {/* Milestones */}
          <motion.div variants={itemVariants}>
            <p className="text-white font-bold text-sm mb-3">รางวัลที่จะได้</p>
            <Card className="p-4">
              <div className="space-y-3">
                {milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${m.done ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500'}`}>
                      {m.done ? <I8Icon name="checkmark" size={14} /> : m.count}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${m.done ? 'text-gray-400 line-through' : 'text-white font-medium'}`}>ชวน {m.count} คน</p>
                    </div>
                    <Badge variant={m.done ? 'success' : 'outline'} className="text-[10px]">{m.reward}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Share Buttons */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12 gap-2">
              <I8Icon name="share" size={16} /> แชร์ผ่าน LINE
            </Button>
            <Button variant="outline" className="h-12 gap-2">
              <I8Icon name="link" size={16} /> คัดลอกลิงก์
            </Button>
          </motion.div>

          {/* Referral History */}
          <motion.div variants={itemVariants}>
            <Separator className="my-2" />
            <p className="text-white font-bold text-sm mb-3">ประวัติการชวน</p>
            <div className="space-y-2">
              {referralHistory.map(ref => (
                <Card key={ref.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-app-red/20 flex items-center justify-center text-xs font-bold text-white">
                      {ref.name[ref.name.length - 1]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{ref.name}</p>
                      <p className="text-gray-500 text-[10px]">{ref.date}</p>
                    </div>
                  </div>
                  <span className="text-yellow-400 text-xs font-bold">+{formatPoints(ref.points)}</span>
                </Card>
              ))}
            </div>
          </motion.div>
          <div className="h-4" />
        </motion.div>
      </div>
    </div>
  );
}
