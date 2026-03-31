import React from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, Building2, Cpu, History, Users, Package, 
  TrendingUp, Settings, ChevronLeft, ChevronRight, Droplets 
} from 'lucide-react';
import type { AdminUser } from '@/services/mockData';

const menuItems = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'branches', label: 'จัดการสาขา', icon: Building2 },
  { id: 'machines', label: 'สถานะเครื่อง', icon: Cpu },
  { id: 'sessions', label: 'รายการล้างรถ', icon: History },
  { id: 'customers', label: 'ลูกค้า', icon: Users },
  { id: 'packages', label: 'แพ็กเกจ/คูปอง', icon: Package },
  { id: 'revenue', label: 'รายได้', icon: TrendingUp },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: any) => void;
  collapsed: boolean;
  onToggle: () => void;
  user: AdminUser;
}

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle, user }: SidebarProps) {
  return (
    <aside className={cn(
      'h-screen flex flex-col bg-gray-900/80 border-r border-gray-800/50 transition-all duration-300 relative',
      collapsed ? 'w-[72px]' : 'w-[260px]'
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-gray-800/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0">
          <Droplets className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-black tracking-tight text-white">ROBOSS</h1>
            <p className="text-[10px] text-gray-500 -mt-0.5">Admin Dashboard</p>
          </div>
        )}
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-3">
          <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
              {user.role === 'hq_admin' ? 'HQ Admin' : user.role === 'franchise_owner' ? 'Franchise Owner' : 'Branch Manager'}
            </span>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-red-500/15 text-red-400 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-red-400')} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Bottom */}
      <div className="border-t border-gray-800/50 p-3">
        {!collapsed && (
          <p className="text-[9px] text-gray-600 text-center">
            ROBOSS Car Wash Management v1.0
          </p>
        )}
      </div>
    </aside>
  );
}
