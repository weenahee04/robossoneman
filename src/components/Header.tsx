import React from 'react';
export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-app-black/95 backdrop-blur-sm border-b border-app-dark px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <img
          src="/Roboss_logo.png"
          alt="ROBOSS Logo"
          className="h-10 w-auto object-contain" />
        
      </div>

      <div className="flex items-center gap-4">
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
    </header>);

}