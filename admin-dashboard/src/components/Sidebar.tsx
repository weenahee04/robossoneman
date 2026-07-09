import React from 'react';
import { cn } from '@/lib/utils';
import {
  Bell,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Crown,
  Droplets,
  Gift,
  History,
  LayoutDashboard,
  Megaphone,
  MessageSquareMore,
  Package,
  ReceiptText,
  Stamp,
  ShieldCheck,
  SlidersHorizontal,
  TicketPercent,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import type { PageName } from '@/App';
import type { AdminUser } from '@/services/api';

interface SidebarProps {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: AdminUser;
}

type MenuItem = {
  id: PageName;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

export function Sidebar({
  currentPage,
  onNavigate,
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
  user,
}: SidebarProps) {
  const hqItems: MenuItem[] =
    user.role === 'hq_admin'
      ? [
          { id: 'admins', label: 'ผู้ดูแลระบบ', icon: ShieldCheck },
          { id: 'policies', label: 'นโยบาย', icon: SlidersHorizontal },
        ]
      : [];

  const groups: MenuGroup[] = [
    {
      label: 'Overview',
      items: [{ id: 'dashboard', label: 'ภาพรวมระบบ', icon: LayoutDashboard }],
    },
    {
      label: 'Business',
      items: [
        { id: 'branches', label: user.role === 'hq_admin' ? 'สาขา' : 'ข้อมูลสาขา', icon: Building2 },
        ...hqItems,
        { id: 'packages', label: 'แพ็กเกจ', icon: Package },
        { id: 'payment-setup', label: 'ตั้งค่าชำระเงิน', icon: WalletCards },
      ],
    },
    {
      label: 'Customer',
      items: [
        { id: 'customers', label: 'ลูกค้า', icon: Users },
        { id: 'coupons', label: 'คูปอง', icon: TicketPercent },
        { id: 'stamps', label: 'แสตมลูกค้า', icon: Stamp },
        { id: 'memberships', label: 'Active Members', icon: Crown },
        { id: 'rewards', label: 'ของรางวัล', icon: Gift },
        { id: 'promotions', label: 'โปรโมชั่น', icon: Megaphone },
        { id: 'notifications', label: 'การแจ้งเตือน', icon: Bell },
        { id: 'feedback', label: 'ข้อเสนอแนะ', icon: MessageSquareMore },
      ],
    },
    {
      label: 'Operations',
      items: [
        { id: 'machines', label: 'เครื่องล้าง', icon: Cpu },
        { id: 'cashier', label: 'แคชเชียร์', icon: Calculator },
        { id: 'sessions', label: 'หน้าจอพนักงาน', icon: History },
        { id: 'payments', label: 'การชำระเงิน', icon: ReceiptText },
      ],
    },
    {
      label: 'Analytics',
      items: [{ id: 'revenue', label: 'รายได้', icon: TrendingUp }],
    },
  ];

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 md:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen max-w-[86vw] flex-col border-r border-slate-200 bg-white/95 shadow-[12px_0_40px_rgba(148,163,184,0.12)] backdrop-blur transition-all duration-300 md:static md:z-auto md:max-w-none',
          collapsed ? 'w-[76px]' : 'w-[272px] sm:w-[288px] md:w-[272px]',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          'md:translate-x-0'
        )}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 shadow-sm shadow-red-500/20">
            <Droplets className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight text-slate-950">ROBOSS</h1>
              <p className="truncate text-[11px] font-medium text-slate-500">Operations Console</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 py-4">
            <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-3 shadow-[0_12px_30px_rgba(239,68,68,0.08)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">
                {user.role === 'hq_admin' ? 'HQ Control' : 'Branch Control'}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                {user.role === 'hq_admin' ? 'ควบคุมทุกสาขา' : 'พื้นที่สาขาที่ได้รับสิทธิ์'}
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                        isActive
                          ? 'bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950',
                        collapsed && 'justify-center px-0'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {isActive && !collapsed && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-red-500" />}
                      <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-red-600' : 'text-slate-400 group-hover:text-slate-600')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          onClick={onToggle}
          className="absolute -right-3 top-24 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-red-100 bg-white text-red-600 shadow-md shadow-slate-200/80 transition-colors hover:bg-red-50 hover:text-red-700 md:flex"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        <div className="border-t border-slate-200 p-4">
          {!collapsed ? (
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Signed in</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800">{user.name}</p>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-sm font-bold text-red-700">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
