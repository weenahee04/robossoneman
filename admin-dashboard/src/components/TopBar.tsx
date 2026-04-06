import React from 'react';
import { Bell, LogOut, Menu, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '@/App';
import type { AdminUser, BranchOption } from '@/services/api';

interface TopBarProps {
  theme: ThemeMode;
  user: AdminUser;
  branches: BranchOption[];
  selectedBranchId: string | null;
  onSelectBranch: (branchId: string | null) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export function TopBar({
  theme,
  user,
  branches,
  selectedBranchId,
  onSelectBranch,
  onToggleTheme,
  onLogout,
  onToggleSidebar,
}: TopBarProps) {
  const branchOptions =
    user.role === 'hq_admin'
      ? branches
      : branches.filter((branch) => user.branchIds.includes(branch.id));

  return (
    <header className="border-b border-red-950/60 bg-black/65 px-4 py-3 backdrop-blur-sm sm:px-5 lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="เปิดเมนูนำทาง"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="text-xs tracking-[0.24em] text-red-200/55">ระบบจัดการหลังบ้าน</p>
            <p className="text-sm font-medium leading-6 text-white sm:pr-4">
              {user.role === 'hq_admin'
                ? 'ควบคุมภาพรวม เปรียบเทียบสาขา และตั้งค่านโยบายจากส่วนกลาง'
                : 'พื้นที่ปฏิบัติการของสาขาตามสิทธิ์ที่ได้รับ'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:justify-end">
          <select
            value={selectedBranchId ?? ''}
            onChange={(event) => onSelectBranch(event.target.value || null)}
            className="min-w-0 rounded-xl border border-red-950/60 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-red-500/50 focus:outline-none sm:min-w-[220px]"
          >
            {user.role === 'hq_admin' && <option value="">ทุกสาขา</option>}
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.shortName || branch.name}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <button
              onClick={onToggleTheme}
              className="rounded-xl border border-red-950/60 bg-white/[0.03] p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-white"
              title={theme === 'dark' ? 'เปิดโหมดขาว' : 'เปิดโหมดมืด'}
              aria-label={theme === 'dark' ? 'เปิดโหมดขาว' : 'เปิดโหมดมืด'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button className="relative rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-white">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-gray-900" />
            </button>

            <div className="flex min-w-0 items-center gap-3 border-l border-gray-800 pl-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="hidden truncate text-[10px] text-gray-500 sm:block">{user.email}</p>
              </div>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 text-sm font-semibold text-white">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <button
                onClick={onLogout}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="ออกจากระบบ"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
