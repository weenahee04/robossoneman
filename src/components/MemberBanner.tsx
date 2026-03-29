import React from 'react';
import { Car } from 'lucide-react';
export function MemberBanner() {
  return (
    <div className="px-4 py-4">
      <div className="bg-gradient-to-r from-app-red-dark via-app-red to-red-500 rounded-2xl p-4 relative overflow-visible shadow-[0_4px_20px_rgba(220,38,38,0.25)]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full -ml-8 -mb-8 blur-xl"></div>

<div className="relative z-10 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-white/90">
                สมัครสมาชิก ROBOSS
              </span>
              <div className="bg-app-black/40 p-1 rounded text-white">
                <Car size={12} />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white leading-none tracking-tight mb-1">
              NEW MEMBER
            </h3>
            <p className="text-[10px] text-white/80">ล้างรถสะอาด ราคาคุ้มค่า</p>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="bg-app-black text-white px-3 py-1 rounded-full text-xs font-bold mb-1 border border-white/20">
              รับส่วนลดทันที
            </div>
            <div className="flex items-baseline text-white">
              <span className="text-4xl font-black tracking-tighter">50</span>
              <span className="text-lg font-bold ml-1">%</span>
            </div>
            <p className="text-[8px] text-white/70 mt-1 max-w-[120px] text-right">
              สำหรับการล้างรถครั้งแรก เมื่อสมัครสมาชิกใหม่
            </p>
          </div>
        </div>
      </div>
    </div>);

}