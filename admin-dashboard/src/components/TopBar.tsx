import React from 'react';
import { Building2, LogOut, Menu, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '@/App';
import type { AdminUser, BranchOption } from '@/services/api';

interface TopBarProps {
  theme: ThemeMode;
  user: AdminUser;
  branches: BranchOption[];
  selectedBranchId: string | null;
  pageTitle: string;
  pageDescription: string;
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
  pageTitle,
  pageDescription,
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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-3 py-3 shadow-sm shadow-slate-200/50 backdrop-blur-xl sm:px-5 lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2 sm:gap-4">
          <button
            onClick={onToggleSidebar}
            className="mt-0.5 shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm shadow-slate-200/60 transition-colors hover:bg-red-50 hover:text-red-700 md:hidden"
            aria-label="เปิดเมนูนำทาง"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-lg font-black leading-tight text-slate-950 sm:truncate sm:text-xl">{pageTitle}</h2>
            <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500 sm:text-sm sm:pr-4">{pageDescription}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm shadow-slate-200/40 sm:min-w-[240px]">
            <Building2 className="h-4 w-4 shrink-0 text-red-600" />
            <span className="hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 xl:block">กำลังดู</span>
            <select
              value={selectedBranchId ?? ''}
              onChange={(event) => onSelectBranch(event.target.value || null)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
              aria-label="เลือกสาขาที่ต้องการดู"
            >
              {user.role === 'hq_admin' && <option value="">ทุกสาขา</option>}
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.shortName || branch.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onToggleTheme}
              className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm shadow-slate-200/60 transition-colors hover:bg-red-50 hover:text-red-700"
              title={theme === 'dark' ? 'เปิดโหมดขาว' : 'เปิดโหมดมืด'}
              aria-label={theme === 'dark' ? 'เปิดโหมดขาว' : 'เปิดโหมดมืด'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="flex min-w-0 items-center gap-2 border-l border-slate-200 pl-2 sm:gap-3 sm:pl-3">
              <div className="hidden min-w-0 text-right min-[420px]:block">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="hidden truncate text-[10px] text-slate-500 sm:block">
                  {user.role === 'hq_admin' ? 'ผู้ดูแลสำนักงานใหญ่' : 'ผู้ดูแลสาขา'}
                </p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-sm font-semibold text-white shadow-sm shadow-red-500/20">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <button
                onClick={onLogout}
                className="rounded-2xl p-2.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
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
