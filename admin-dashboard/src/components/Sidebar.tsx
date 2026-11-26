import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bell,
  Building2,
  Calculator,
  ChevronDown,
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
  Settings2,
  Stamp,
  ShieldCheck,
  SlidersHorizontal,
  TicketPercent,
  TrendingUp,
  Users,
  WalletCards,
  Workflow,
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
  helper?: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuSection = {
  id: string;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultPage: PageName;
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
  const sections = useMemo<MenuSection[]>(() => {
    const items: MenuSection[] = [
      {
        id: 'overview',
        label: 'ภาพรวม',
        helper: 'สถานะสำคัญวันนี้',
        icon: LayoutDashboard,
        defaultPage: 'dashboard',
        items: [{ id: 'dashboard', label: 'ภาพรวมวันนี้', icon: LayoutDashboard }],
      },
      {
        id: 'operations',
        label: 'งานหน้าร้าน',
        helper: 'คิว เครื่อง และรับชำระ',
        icon: Workflow,
        defaultPage: 'sessions',
        items: [
          { id: 'sessions', label: 'คิวและรอบล้าง', helper: 'งานที่กำลังให้บริการ', icon: History },
          { id: 'cashier', label: 'รับชำระหน้าร้าน', helper: 'เงินสดและสลิป', icon: Calculator },
          { id: 'machines', label: 'สถานะเครื่อง', helper: 'ออนไลน์และซ่อมบำรุง', icon: Cpu },
          { id: 'payments', label: 'รายการชำระเงิน', helper: 'ตรวจสอบและกระทบยอด', icon: ReceiptText },
        ],
      },
      {
        id: 'customers',
        label: 'ลูกค้าและสิทธิ์',
        helper: 'สมาชิก คูปอง และสะสมแต้ม',
        icon: Users,
        defaultPage: 'customers',
        items: [
          { id: 'customers', label: 'ข้อมูลลูกค้า', icon: Users },
          { id: 'coupons', label: 'คูปอง', icon: TicketPercent },
          { id: 'memberships', label: 'สมาชิกและเครดิต', icon: Crown },
          { id: 'stamps', label: 'แสตมสะสม', icon: Stamp },
          { id: 'points', label: 'พ้อยท์ลูกค้า', icon: Gift },
          { id: 'rewards', label: 'ของรางวัล', icon: Gift },
          { id: 'reward-redemptions', label: 'รายการแลกรางวัล', icon: Gift },
        ],
      },
      {
        id: 'engagement',
        label: 'สื่อสารลูกค้า',
        helper: 'โปรโมชัน ข่าวสาร และปัญหา',
        icon: Megaphone,
        defaultPage: 'promotions',
        items: [
          { id: 'promotions', label: 'โปรโมชัน', icon: Megaphone },
          { id: 'notifications', label: 'ส่งข่าวสาร', icon: Bell },
          { id: 'feedback', label: 'ปัญหาและข้อเสนอแนะ', icon: MessageSquareMore },
        ],
      },
      {
        id: 'business',
        label: 'สาขาและรายได้',
        helper: 'ยอดขาย บริการ และการตั้งค่าสาขา',
        icon: Building2,
        defaultPage: 'revenue',
        items: [
          { id: 'revenue', label: 'รายได้และรายงาน', icon: TrendingUp },
          { id: 'packages', label: 'บริการและราคา', icon: Package },
          { id: 'branches', label: user.role === 'hq_admin' ? 'จัดการสาขา' : 'ข้อมูลสาขา', icon: Building2 },
          { id: 'payment-setup', label: 'ตั้งค่ารับเงิน', icon: WalletCards },
          { id: 'audit-logs', label: 'ประวัติการทำรายการ', icon: History },
        ],
      },
    ];

    if (user.role === 'hq_admin') {
      items.push({
        id: 'settings',
        label: 'ตั้งค่าระบบ',
        helper: 'ผู้ดูแลและนโยบายกลาง',
        icon: Settings2,
        defaultPage: 'admins',
        items: [
          { id: 'admins', label: 'ผู้ดูแลและสิทธิ์', icon: ShieldCheck },
          { id: 'policies', label: 'นโยบายส่วนกลาง', icon: SlidersHorizontal },
          { id: 'membership-plans', label: 'แผนสมาชิก', icon: Crown },
          { id: 'content', label: 'เนื้อหาในแอป', icon: Megaphone },
        ],
      });
    }

    if (user.role === 'cashier') {
      return [{ id: 'cashier-work', label: 'งานแคชเชียร์', helper: 'รับชำระและดูคิวในสาขา', icon: Calculator, defaultPage: 'cashier', items: [
        { id: 'cashier', label: 'รับชำระหน้าร้าน', icon: Calculator },
        { id: 'sessions', label: 'คิวและรอบล้าง', icon: History },
      ] }];
    }
    return items;
  }, [user.role]);

  const activeSection = sections.find((section) => section.items.some((item) => item.id === currentPage))?.id ?? 'overview';
  const [openSection, setOpenSection] = useState(activeSection);

  useEffect(() => {
    setOpenSection(activeSection);
  }, [activeSection]);

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
          collapsed ? 'w-[76px]' : 'w-[264px] sm:w-[280px] md:w-[264px]',
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
              <p className="truncate text-[11px] font-medium text-slate-500">ระบบจัดการร้านล้างรถ</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 py-3">
            <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700">
                {user.role === 'hq_admin' ? 'สำนักงานใหญ่' : user.role === 'cashier' ? 'แคชเชียร์' : 'ผู้ดูแลสาขา'}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">
                {user.role === 'hq_admin' ? 'ดูแลทุกสาขาในระบบ' : `${user.branchIds.length} สาขาที่ได้รับสิทธิ์`}
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar" aria-label="เมนูหลัก">
          <div className="space-y-1.5">
            {sections.map((section) => {
              const SectionIcon = section.icon;
              const isSectionActive = activeSection === section.id;
              const isOpen = openSection === section.id;
              const isSingle = section.items.length === 1;

              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed || isSingle) {
                        onNavigate(section.defaultPage);
                        return;
                      }
                      setOpenSection((current) => (current === section.id ? '' : section.id));
                    }}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all',
                      isSectionActive
                        ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? section.label : undefined}
                    aria-expanded={isSingle ? undefined : isOpen}
                  >
                    <SectionIcon className={cn('h-5 w-5 shrink-0', isSectionActive ? 'text-red-600' : 'text-slate-400')} />
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{section.label}</span>
                          <span className="block truncate text-[10px] font-medium text-slate-400">{section.helper}</span>
                        </span>
                        {!isSingle && <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />}
                      </>
                    )}
                  </button>

                  {!collapsed && !isSingle && isOpen && (
                    <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = currentPage === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onNavigate(item.id)}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                              isActive
                                ? 'bg-slate-900 font-semibold text-white shadow-sm'
                                : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                            )}
                          >
                            <ItemIcon className={cn('h-4 w-4 shrink-0', isActive ? 'text-red-300' : 'text-slate-400')} />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <button
          onClick={onToggle}
          className="absolute -right-3 top-24 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-red-100 bg-white text-red-600 shadow-md shadow-slate-200/80 transition-colors hover:bg-red-50 hover:text-red-700 md:flex"
          aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        <div className="border-t border-slate-200 p-3">
          {!collapsed ? (
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-sm font-bold text-red-700">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="truncate text-[10px] text-slate-400">กำลังใช้งาน</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-red-700">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
