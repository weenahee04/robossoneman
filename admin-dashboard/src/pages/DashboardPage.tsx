import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calculator,
  Cpu,
  DollarSign,
  History,
  TicketPercent,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api, { type AdminUser, type DashboardData } from '@/services/api';
import type { PageName } from '@/App';

interface DashboardPageProps {
  admin: AdminUser;
  branchId: string | null;
  onNavigate: (page: PageName) => void;
}

export function DashboardPage({ admin, branchId, onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.fetchDashboard(branchId);
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load dashboard');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const selectedBranchชื่อ = useMemo(() => {
    if (!branchId) {
      return admin.role === 'hq_admin' ? 'ภาพรวม HQ ครอบคลุมทุกสาขา' : 'ขอบเขตสาขาที่ได้รับมอบหมาย';
    }

    return admin.scopes.find((scope) => scope.branchId === branchId)?.branch?.name ?? 'สาขาที่เลือก';
  }, [admin, branchId]);

  const summary = data?.summary;
  const customerGrowthDelta =
    summary && summary.customerGrowthPrevious > 0
      ? Math.round(((summary.customerGrowthCurrent - summary.customerGrowthPrevious) / summary.customerGrowthPrevious) * 100)
      : summary?.customerGrowthCurrent ?? 0;

  return (
    <div className="max-w-[1440px] space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">สรุปวันนี้</p>
          <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">{selectedBranchชื่อ}</h2>
          <p className="mt-1 text-sm text-gray-500">ตัวเลขสำคัญและงานที่ควรจัดการตอนนี้</p>
        </div>
        <p className="text-xs text-gray-500">อัปเดตจากข้อมูลในระบบตามสาขาที่เลือก</p>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'รายได้วันนี้', value: `${(summary?.todayRevenue ?? 0).toLocaleString()}฿`, helper: 'ยอดที่ยืนยันแล้ว', icon: DollarSign, tone: 'text-green-600 bg-green-500/10' },
          { label: 'รอบล้างวันนี้', value: (summary?.todaySessions ?? 0).toLocaleString(), helper: 'รายการทั้งหมดวันนี้', icon: BarChart3, tone: 'text-blue-600 bg-blue-500/10' },
          { label: 'กำลังให้บริการ', value: (summary?.activeSessions ?? 0).toLocaleString(), helper: 'รอบที่ยังไม่จบ', icon: Activity, tone: 'text-violet-600 bg-violet-500/10' },
          { label: 'เครื่องออนไลน์', value: `${data?.machineHealth.onlineRate ?? 0}%`, helper: `${data?.machineHealth.offline ?? 0} ออฟไลน์ • ${data?.machineHealth.maintenance ?? 0} ซ่อม`, icon: Cpu, tone: 'text-amber-600 bg-amber-500/10' },
        ].map((card) => {
          const ไอคอน = card.icon;
          return (
            <div key={card.label} className="gradient-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
                  <p className="mt-1 text-xs text-gray-500">{card.helper}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.tone}`}>
                  <ไอคอน className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="gradient-card rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-white">ไปที่งานที่ใช้บ่อย</h3>
            <p className="mt-1 text-xs text-gray-500">เลือกงานได้ตรงนี้ ไม่ต้องไล่หาในเมนู</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { page: 'sessions' as const, label: 'ดูคิวล้าง', helper: 'ติดตามรอบปัจจุบัน', icon: History },
              { page: 'cashier' as const, label: 'รับชำระ', helper: 'เงินสดและสลิป', icon: Calculator },
              { page: 'coupons' as const, label: 'จัดการคูปอง', helper: 'ขาย ใช้ และตรวจสอบ', icon: TicketPercent },
              { page: 'revenue' as const, label: 'ดูรายได้', helper: 'รายงานและยอดขาย', icon: TrendingUp },
            ].map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.page}
                  type="button"
                  onClick={() => onNavigate(action.page)}
                  className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-left transition hover:border-red-500/20 hover:bg-red-500/[0.05]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                    <ActionIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{action.label}</p>
                    <p className="truncate text-[11px] text-gray-500">{action.helper}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-red-500" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="gradient-card rounded-2xl p-5">
          <h3 className="font-semibold text-white">สิ่งที่ควรเช็ก</h3>
          <div className="mt-4 space-y-2">
            <button onClick={() => onNavigate('machines')} className="flex w-full items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 text-left text-sm">
              <span className="text-gray-400">เครื่องออฟไลน์/ซ่อม</span>
              <span className={(data?.machineHealth.offline ?? 0) + (data?.machineHealth.maintenance ?? 0) > 0 ? 'font-bold text-amber-400' : 'font-semibold text-emerald-400'}>
                {(data?.machineHealth.offline ?? 0) + (data?.machineHealth.maintenance ?? 0)} เครื่อง
              </span>
            </button>
            <button onClick={() => onNavigate('sessions')} className="flex w-full items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 text-left text-sm">
              <span className="text-gray-400">รอบที่กำลังทำงาน</span>
              <span className="font-semibold text-white">{summary?.activeSessions ?? 0} รอบ</span>
            </button>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
              <span className="text-gray-400">ลูกค้าใหม่ 14 วัน</span>
              <span className="font-semibold text-white">{summary?.customerGrowthCurrent ?? 0} คน ({customerGrowthDelta >= 0 ? '+' : ''}{customerGrowthDelta}%)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="gradient-card rounded-2xl p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">แนวโน้มรายได้</h3>
              <p className="text-xs text-gray-500">ยอดชำระที่ยืนยันแล้วใน 7 วันล่าสุด</p>
            </div>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data?.revenueTrend ?? []}>
              <defs>
                <linearGradient id="dashboardรายได้" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                formatter={(value: number, key: string) => [value.toLocaleString(), key]}
              />
              <Area type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} fill="url(#dashboardรายได้)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="gradient-card rounded-2xl p-5">
          <h3 className="mb-4 font-semibold text-white">สถานะเครื่อง</h3>
          <div className="space-y-3">
            {[
              ['ออนไลน์', data?.machineHealth.online ?? 0],
              ['ซ่อมบำรุง', data?.machineHealth.maintenance ?? 0],
              ['กำลังล้าง', data?.machineHealth.washing ?? 0],
              ['จองแล้ว', data?.machineHealth.reserved ?? 0],
              ['ออฟไลน์', data?.machineHealth.offline ?? 0],
            ].map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
                <span className="text-sm text-gray-300">{label}</span>
                <span className="text-sm font-semibold text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="gradient-card rounded-2xl p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">การเติบโตของลูกค้า</h3>
              <p className="text-xs text-gray-500">ลูกค้าใหม่ในขอบเขตปัจจุบันย้อนหลัง 14 วัน</p>
            </div>
            <Users className="h-4 w-4 text-gray-500" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.customerGrowthTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                formatter={(value: number) => [value.toLocaleString(), 'ลูกค้า']}
              />
              <Bar dataKey="customers" fill="#f97316" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="gradient-card rounded-2xl p-5">
          <h3 className="mb-4 font-semibold text-white">สถานะรอบวันนี้</h3>
          <div className="space-y-3">
            {Object.entries(data?.sessionStatusSummary ?? {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
                <span className="text-sm capitalize text-gray-300">{status.replace(/_/g, ' ')}</span>
                <span className="text-sm font-semibold text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="gradient-card rounded-2xl p-5">
          <h3 className="mb-4 font-semibold text-white">เปรียบเทียบสาขาวันนี้</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.branchPerformance ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="shortName" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                formatter={(value: number) => [value.toLocaleString(), 'รายได้']}
              />
              <Bar dataKey="todayRevenue" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="gradient-card rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-white">รอบล่าสุด</h3>
            <span className="text-xs text-gray-500">{data?.recentSessions.length ?? 0} รายการ</span>
          </div>
          <div className="space-y-3">
            {(data?.recentSessions ?? []).map((session) => (
              <div key={session.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{session.user.displayName}</p>
                    <p className="text-xs text-gray-500">
                      {session.branch.shortName || session.branch.name} • {session.machine.name} • {session.package.name}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-gray-300">
                    {session.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {session.totalPrice.toLocaleString()} บาท • ความคืบหน้า {session.progress}%
                  </span>
                  <span>{new Date(session.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



