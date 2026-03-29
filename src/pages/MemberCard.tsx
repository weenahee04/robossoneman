import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import fireAnimation from '../Fire.json';
import { Gift, RotateCcw } from 'lucide-react';

const TOTAL_STAMPS = 10;
const STORAGE_KEY = 'roboss_stamps';
interface MemberCardProps {
  onBack: () => void;
}
const transactions = [
{
  id: 1,
  service: 'ล้างรถอัตโนมัติ',
  branch: 'สาขาลาดพร้าว',
  date: '15 มี.ค. 2024',
  points: '+50'
},
{
  id: 2,
  service: 'เคลือบแก้ว',
  branch: 'สาขาสุขุมวิท 71',
  date: '2 มี.ค. 2024',
  points: '+200'
},
{
  id: 3,
  service: 'ดูดฝุ่นภายใน',
  branch: 'สาขาบางนา',
  date: '28 ก.พ. 2024',
  points: '+20'
},
{
  id: 4,
  service: 'ล้างรถอัตโนมัติ',
  branch: 'สาขาพหลโยธิน',
  date: '10 ก.พ. 2024',
  points: '+50'
}];

export function MemberCard({ onBack }: MemberCardProps) {
  const [stamps, setStamps] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [animating, setAnimating] = useState<number | null>(null);
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(stamps));
    if (stamps === TOTAL_STAMPS) setTimeout(() => setShowReward(true), 400);
  }, [stamps]);

  const addStamp = () => {
    if (stamps >= TOTAL_STAMPS) return;
    const next = stamps + 1;
    setAnimating(next - 1);
    setStamps(next);
    setTimeout(() => setAnimating(null), 800);
  };

  const reset = () => { setStamps(0); setShowReward(false); };

  const containerVariants = {
    hidden: {
      opacity: 0
    },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20
    },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    }
  };
  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-y-auto no-scrollbar relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-app-dark bg-app-black/95 sticky top-0 z-50">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors text-xl font-light">
          
          ‹
        </button>
        <h1 className="text-white font-bold text-lg">บัตรสมาชิก</h1>
        <div className="w-10" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="px-4 py-6 space-y-8 pb-24">
        
        {/* Digital Member Card */}
        <motion.div
          variants={itemVariants}
          className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden border border-white/10">
          
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-app-black to-app-red-dark"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/20 opacity-50"></div>

          <motion.div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
            animate={{
              translateX: ['-100%', '200%']
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 5,
              ease: 'easeInOut'
            }} />
          

          <div className="relative z-10 p-5 flex flex-col h-full justify-between">
            {/* Top Row */}
            <div className="flex justify-between items-start">
              <div>
                <img
                  src="/Roboss_logo.png"
                  alt="ROBOSS Logo"
                  className="h-6 w-auto object-contain mb-1" />
                
                <p className="text-[10px] text-gray-400 tracking-widest uppercase">
                  Member Card
                </p>
              </div>
              <div className="bg-amber-500/20 border border-amber-500/50 px-2.5 py-1 rounded-full">
                <span className="text-xs font-bold text-amber-400">
                  GOLD MEMBER
                </span>
              </div>
            </div>

            {/* Middle Row - QR Code & Details */}
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-xs text-gray-400">ชื่อสมาชิก</p>
                <p className="text-lg font-bold text-white tracking-wide">
                  คุณ W
                </p>
                <div className="pt-2">
                  <p className="text-[10px] text-gray-500">รหัสสมาชิก</p>
                  <p className="text-sm font-mono text-gray-300 tracking-widest">
                    RB-2024-00158
                  </p>
                </div>
              </div>

              {/* QR Code Placeholder */}
              <div className="bg-white p-2 rounded-xl shadow-lg">
                <div className="w-12 h-12 grid grid-cols-5 grid-rows-5 gap-[2px]">
                  {Array.from({
                    length: 25
                  }).map((_, i) =>
                  <div
                    key={i}
                    className={`rounded-[1px] ${[0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 20, 22, 23, 24].includes(i) ? 'bg-app-black' : 'bg-gray-300'}`} />

                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2">
              <p className="text-[10px] text-gray-400">
                สมาชิกตั้งแต่ ม.ค. 2024
              </p>
              <div className="flex gap-1">
                <div className="w-6 h-4 bg-red-500/20 rounded-sm border border-red-500/30"></div>
                <div className="w-6 h-4 bg-amber-500/20 rounded-sm border border-amber-500/30"></div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stamp Collection */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-white font-bold text-base">สะสมแสตมป์</h3>
              <p className="text-[10px] text-gray-400">ล้างรถ {TOTAL_STAMPS} ครั้ง รับฟรี 1 ครั้ง</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-yellow-400">{stamps}/{TOTAL_STAMPS}</span>
              <button onClick={reset} className="w-7 h-7 rounded-full bg-app-dark flex items-center justify-center text-gray-500">
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${(stamps / TOTAL_STAMPS) * 100}%` }} />
          </div>

          {/* Stamp grid */}
          <div className="bg-app-dark rounded-2xl p-4 border border-white/5">
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: TOTAL_STAMPS }).map((_, i) => {
                const collected = i < stamps;
                return (
                  <div key={i} className={`relative aspect-square rounded-full flex items-center justify-center transition-all duration-300
                    ${collected
                      ? 'bg-gradient-to-br from-orange-900/60 to-yellow-900/40 border border-orange-500/40 shadow-[0_0_10px_rgba(234,88,12,0.25)]'
                      : 'bg-transparent border-2 border-dashed border-white/30'}
                    ${animating === i ? 'scale-125' : 'scale-100'}`}>
                    {collected
                      ? <Lottie animationData={fireAnimation} loop={true} className="w-full h-full p-0.5" />
                      : <span className="text-base font-black text-white/20">{i + 1}</span>}
                  </div>
                );
              })}
            </div>

            {/* Reward row */}
            <div className="mt-3 flex items-center gap-3 bg-black/30 rounded-xl p-3 border border-yellow-500/20">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500
                ${stamps === TOTAL_STAMPS ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_0_14px_rgba(234,179,8,0.5)]' : 'bg-black/40 border border-white/10'}`}>
                <Gift size={18} className={stamps === TOTAL_STAMPS ? 'text-white' : 'text-white/20'} />
              </div>
              <div>
                <p className={`text-sm font-bold ${stamps === TOTAL_STAMPS ? 'text-yellow-400' : 'text-white/30'}`}>ล้างรถฟรี 1 ครั้ง</p>
                <p className="text-[10px] text-gray-500">เมื่อสะสมครบ {TOTAL_STAMPS} แสตมป์</p>
              </div>
              {stamps === TOTAL_STAMPS && (
                <button className="ml-auto bg-yellow-400 text-yellow-900 font-bold text-xs px-3 py-1.5 rounded-full">รับเลย</button>
              )}
            </div>
          </div>

          {/* Reward banner */}
          {showReward && (
            <div className="bg-gradient-to-r from-orange-600 via-yellow-500 to-orange-500 rounded-2xl p-4 text-center shadow-[0_4px_20px_rgba(234,88,12,0.4)]">
              <p className="text-white font-black text-base">🎉 ยินดีด้วย! สะสมครบ {TOTAL_STAMPS} แสตมป์แล้ว</p>
              <p className="text-white/80 text-xs mt-1">กดรับเลยเพื่อใช้สิทธิ์ล้างรถฟรี</p>
            </div>
          )}

          {/* Demo button */}
          <button onClick={addStamp} disabled={stamps >= TOTAL_STAMPS}
            className="w-full bg-app-dark border border-white/10 text-gray-300 font-medium py-3 rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform">
            {stamps >= TOTAL_STAMPS ? 'สะสมแสตมป์ครบแล้ว 🎉' : '+ จำลองการล้างรถ (เพิ่มแสตมป์)'}
          </button>
        </motion.div>

        {/* Recent Transaction History */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-white font-bold text-base">ประวัติการใช้งาน</h3>
            <button className="text-xs text-app-red font-medium hover:text-red-400 transition-colors">
              ดูทั้งหมด ›
            </button>
          </div>

          <div className="space-y-2">
            {transactions.map((tx) =>
            <div
              key={tx.id}
              className="bg-app-dark rounded-xl p-4 border border-white/5 flex items-center gap-4">
              
                <div className="w-10 h-10 rounded-full bg-app-red/10 flex items-center justify-center border border-app-red/20 shrink-0">
                  <span className="text-app-red text-xs font-black">R</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {tx.service}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {tx.branch} • {tx.date}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-green-500">
                    {tx.points}
                  </span>
                  <p className="text-[10px] text-gray-500">คะแนน</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-app-black via-app-black to-transparent z-40">
        <div className="flex gap-3">
          <button className="flex-1 bg-app-dark border border-white/10 text-white font-bold py-3.5 rounded-xl transition-colors hover:bg-white/5 text-sm">
            ดูสิทธิพิเศษทั้งหมด
          </button>
          <button className="flex-1 bg-app-red hover:bg-red-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-red-900/50 text-sm">
            แลกคะแนน
          </button>
        </div>
      </div>
    </div>);

}