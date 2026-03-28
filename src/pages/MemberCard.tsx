import React, { Children } from 'react';
import { motion } from 'framer-motion';
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
          className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(220,38,38,0.3)] border border-white/10">
          
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