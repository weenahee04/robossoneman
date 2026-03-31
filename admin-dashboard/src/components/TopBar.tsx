import React from 'react';
import { Bell, LogOut, Menu, Search } from 'lucide-react';
import type { AdminUser } from '@/services/mockData';

interface TopBarProps {
  user: AdminUser;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export function TopBar({ user, onLogout, onToggleSidebar }: TopBarProps) {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-gray-800/50 bg-gray-900/40 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar} 
          className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาสาขา, เครื่อง, ลูกค้า..."
            className="w-72 pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-gray-900" />
        </button>

        {/* User */}
        <div className="flex items-center gap-3 pl-3 border-l border-gray-800">
          <div className="text-right">
            <p className="text-sm font-medium text-white">{user.displayName}</p>
            <p className="text-[10px] text-gray-500">{user.email}</p>
          </div>
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-700">
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          </div>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
