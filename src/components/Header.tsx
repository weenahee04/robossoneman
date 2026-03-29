import React from 'react';
import Lottie from 'lottie-react';
import fireAnimation from '../Fire.json';
export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-app-black/95 backdrop-blur-sm border-b border-app-dark px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <img
          src="/Roboss_logo.png"
          alt="ROBOSS Logo"
          className="h-16 w-auto object-contain" />
      </div>

      <div className="flex items-center gap-3">
        {/* Points badge */}
        <div className="relative flex items-center gap-1.5 bg-app-dark border border-yellow-500/30 rounded-full pl-8 pr-3 py-1.5 overflow-visible">
          {/* Fire — anchored left, overflows top */}
          <div className="absolute left-0 -translate-x-1/4 -top-5 w-12 h-12 pointer-events-none z-10">
            <Lottie animationData={fireAnimation} loop={true} className="w-full h-full" />
          </div>
          <span className="text-xs font-bold text-yellow-400 leading-none whitespace-nowrap">1,250</span>
          <span className="text-[10px] text-gray-400 leading-none whitespace-nowrap">พ้อย</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">สวัสดี !</p>
            <p className="text-sm font-semibold leading-none">W</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-app-dark border-2 border-app-red overflow-hidden flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100"
              alt="User avatar"
              className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </header>);

}