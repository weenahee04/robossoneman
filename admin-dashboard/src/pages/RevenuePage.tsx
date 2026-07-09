import React, { useEffect, useMemo, useState } from 'react';
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
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  RefreshCcw,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import api, { type AdminUser, type RevenueData } from '@/services/api';

interface RevenuePageProps {
  admin: AdminUser;
  branchId: string | null;
}

const dayOptions = [7, 30, 90, 365];

function formatMoney(value?: number | null) {
  return `${Math.round(value ?? 0).toLocaleString()} บาท`;
}

function formatNumber(value?: number | null) {
  return Math.round(value ?? 0).toLocaleString();
}

function formatPercent(value?: number | null) {
  const safeValue = Number(value ?? 0);
  return `${safeValue > 0 ? '+' : ''}${safeValue.toLocaleString()}%`;
}

function getMethodLabel(method: string) {
  switch (method) {
    case 'cash':
      return 'เงินสด';
    case 'manual':
      return 'โอน/สลิป';
    case 'promptpay':
      return 'PromptPay';
    default:
      return method;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'confirmed':
      return 'ยืนยันแล้ว';
    case 'pending':
      return 'รอชำระ';
    case 'failed':
      return 'ไม่สำเร็จ';
    case 'cancelled':
      return 'ยกเลิก';
    case 'refunded':
      return 'คืนเงิน';
    case 'expired':
      return 'หมดอายุ';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function RevenuePage({ admin, branchId }: RevenuePageProps) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await api.fetchRevenue(days, branchId);
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'โหลดรายงานยอดขายไม่สำเร็จ');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId, days]);

  const topPackages = useMemo(() => (data?.packageBreakdown ?? []).slice(0, 6), [data]);
  const topBranches = useMemo(() => (data?.branchTotals ?? []).slice(0, 8), [data]);
  const netRevenue = data?.netRevenue ?? data?.totalRevenue ?? 0;
  const grossSales = data?.grossSales ?? netRevenue + (data?.discountAmount ?? 0);
  const discountAmount = data?.discountAmount ?? 0;
  const refundedAmount = data?.refundedAmount ?? 0;
  const pendingAmount = data?.pendingAmount ?? 0;
  const completionRate = data?.completionRate ?? 0;

  return (
    <div className="w-full max-w-[1480px] space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-700">
            {branchId ? 'Branch Sales' : 'All Branch Sales'}
          </p>
          <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">รายงานยอดขาย</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            ยอดขายสุทธินับจากรายการที่ยืนยันเงินแล้ว หัก refund แยก pending ไว้นอกยอดขาย และจัดกลุ่มตามเวลาไทย Asia/Bangkok
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {dayOptions.map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-xs font-black transition-colors ${
                days === value ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-red-700'
              }`}
            >
              {value} วัน
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <MetricCard title="ยอดขายสุทธิ" value={formatMoney(netRevenue)} icon={TrendingUp} tone="red" detail={formatPercent(data?.revenueGrowthPercent)} />
        <MetricCard title="ยอดก่อนส่วนลด" value={formatMoney(grossSales)} icon={WalletCards} detail={`${formatNumber(data?.sessionCount)} รอบ`} />
        <MetricCard title="ส่วนลด" value={formatMoney(discountAmount)} icon={CreditCard} detail="หักจาก subtotal" />
        <MetricCard title="Refund" value={formatMoney(refundedAmount)} icon={RefreshCcw} tone="amber" detail={`${formatNumber(data?.refundCount)} รายการ`} />
        <MetricCard title="รอชำระ" value={formatMoney(pendingAmount)} icon={AlertTriangle} tone="amber" detail={`${formatNumber(data?.pendingCount)} รายการ`} />
        <MetricCard title="Avg Ticket" value={formatMoney(data?.avgTicket)} icon={Banknote} detail={`${completionRate}% completed`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="gradient-card min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-black text-white">ยอดขายสุทธิรายวัน</h3>
              <p className="mt-1 text-xs text-gray-500">confirmed - refunded ตามวันที่ยืนยันเงิน</p>
            </div>
            {loading && <span className="text-xs font-semibold text-gray-500">กำลังโหลด...</span>}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data?.dailyRevenue ?? []}>
              <defs>
                <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '12px', color: '#0f172a' }}
                formatter={(value: number, key: string) => [formatMoney(value), key === 'total' ? 'ยอดสุทธิ' : key]}
              />
              <Area dataKey="total" type="monotone" stroke="#ef4444" fill="url(#revenueAreaFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="gradient-card rounded-2xl p-4 sm:p-5">
          <h3 className="font-black text-white">Logic ที่ใช้คำนวณ</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-400">
            <LogicRow label="รับรู้รายได้" value="confirmedAt / providerConfirmedAt" />
            <LogicRow label="Timezone" value={data?.salesLogic?.timezone ?? 'Asia/Bangkok'} />
            <LogicRow label="ยอดขายสุทธิ" value="ยอด confirmed - refund" />
            <LogicRow label="Pending" value="แสดงแยก ไม่รวมยอดขาย" />
            <LogicRow label="สาขาที่มีขาย" value={`${formatNumber(data?.activeBranchCount)} / ${formatNumber(data?.branchCount)}`} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="gradient-card rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-red-600" />
            <h3 className="font-black text-white">ยอดขายรายสาขา</h3>
          </div>
          <div className="space-y-3 lg:hidden">
            {topBranches.map((branch) => (
              <BranchSalesCard key={branch.branchId} branch={branch} />
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="px-3 py-3 text-left text-xs uppercase tracking-wider text-gray-500">สาขา</th>
                  <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-gray-500">ยอดสุทธิ</th>
                  <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-gray-500">รอบ</th>
                  <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Avg</th>
                  <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Share</th>
                </tr>
              </thead>
              <tbody>
                {topBranches.map((branch) => (
                  <tr key={branch.branchId} className="border-b border-gray-800/30">
                    <td className="px-3 py-3 text-white">
                      <p className="font-semibold">{branch.name}</p>
                      <p className="text-xs text-gray-500">{branch.code}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-white">{formatMoney(branch.netSales ?? branch.total)}</td>
                    <td className="px-3 py-3 text-right text-gray-300">{formatNumber(branch.sessions)}</td>
                    <td className="px-3 py-3 text-right text-gray-300">{formatMoney(branch.avgTicket)}</td>
                    <td className="px-3 py-3 text-right text-gray-300">{branch.revenueShare ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="gradient-card min-w-0 rounded-2xl p-4 sm:p-5">
          <h3 className="mb-4 font-black text-white">เปรียบเทียบสาขา</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topBranches}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '12px', color: '#0f172a' }}
                formatter={(value: number) => [formatMoney(value), 'ยอดสุทธิ']}
              />
              <Bar dataKey="netSales" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <BreakdownPanel title="แพ็กเกจขายดี">
          {topPackages.map((pkg) => (
            <BreakdownRow
              key={pkg.packageId}
              label={pkg.name}
              subLabel={`${formatNumber(pkg.sessions)} รอบ • Avg ${formatMoney(pkg.avgTicket)}`}
              value={formatMoney(pkg.total)}
              share={pkg.revenueShare}
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel title="ช่องทางรับเงิน">
          {(data?.paymentMethodBreakdown ?? []).map((method) => (
            <BreakdownRow
              key={method.method}
              label={getMethodLabel(method.method)}
              subLabel={`${formatNumber(method.sessions)} รายการ`}
              value={formatMoney(method.total)}
              share={method.share}
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel title="Provider / สถานะ">
          {(data?.providerBreakdown ?? []).map((provider) => (
            <BreakdownRow
              key={provider.provider}
              label={provider.provider}
              subLabel={`${formatNumber(provider.sessions)} รายการ`}
              value={formatMoney(provider.total)}
              share={provider.share}
            />
          ))}
          <div className="mt-4 border-t border-gray-800/40 pt-3">
            {(data?.statusBreakdown ?? []).slice(0, 4).map((status) => (
              <div key={status.status} className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-gray-500">{getStatusLabel(status.status)}</span>
                <span className="font-semibold text-white">{formatNumber(status.count)} รายการ</span>
              </div>
            ))}
          </div>
        </BreakdownPanel>
      </div>

      <section className="gradient-card rounded-2xl p-4 sm:p-5">
        <h3 className="mb-4 font-black text-white">สรุปรายวันละเอียด</h3>
        <div className="space-y-3 lg:hidden">
          {[...(data?.dailyRevenue ?? [])].reverse().map((day) => (
            <div key={day.date} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">{day.date}</p>
                <p className="text-sm font-black text-white">{formatMoney(day.total)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <InfoChip label="Gross" value={formatMoney(day.grossTotal)} />
                <InfoChip label="Discount" value={formatMoney(day.discountAmount)} />
                <InfoChip label="Refund" value={formatMoney(day.refundedAmount)} />
                <InfoChip label="รอบ" value={formatNumber(day.sessions)} />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden max-h-80 overflow-y-auto no-scrollbar lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="px-2 py-3 text-left text-xs uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Gross</th>
                <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Discount</th>
                <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Refund</th>
                <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Net</th>
                <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">รอบ</th>
                <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Avg</th>
              </tr>
            </thead>
            <tbody>
              {[...(data?.dailyRevenue ?? [])].reverse().map((day) => (
                <tr key={day.date} className="border-b border-gray-800/30">
                  <td className="px-2 py-3 text-gray-300">{day.date}</td>
                  <td className="px-2 py-3 text-right text-gray-300">{formatMoney(day.grossTotal)}</td>
                  <td className="px-2 py-3 text-right text-gray-300">{formatMoney(day.discountAmount)}</td>
                  <td className="px-2 py-3 text-right text-gray-300">{formatMoney(day.refundedAmount)}</td>
                  <td className="px-2 py-3 text-right font-semibold text-white">{formatMoney(day.total)}</td>
                  <td className="px-2 py-3 text-right text-gray-300">{formatNumber(day.sessions)}</td>
                  <td className="px-2 py-3 text-right text-gray-300">{formatMoney(day.avgTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'slate',
}: {
  title: string;
  value: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'red' | 'amber' | 'slate';
}) {
  const toneClass =
    tone === 'red'
      ? 'bg-red-50 text-red-700'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-50 text-slate-600';

  return (
    <div className="gradient-card min-w-0 rounded-2xl p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">{title}</p>
      <p className="mt-1 truncate text-xl font-black text-white sm:text-2xl">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p>}
    </div>
  );
}

function LogicRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function BranchSalesCard({ branch }: { branch: NonNullable<RevenueData['branchTotals']>[number] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-white">{branch.name}</p>
          <p className="mt-1 text-xs text-gray-500">{branch.code}</p>
        </div>
        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">{branch.revenueShare ?? 0}%</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <InfoChip label="ยอดสุทธิ" value={formatMoney(branch.netSales ?? branch.total)} strong />
        <InfoChip label="รอบ" value={formatNumber(branch.sessions)} />
        <InfoChip label="เงินสด/สลิป" value={formatMoney(branch.cashSales)} />
        <InfoChip label="ออนไลน์" value={formatMoney(branch.onlineSales)} />
      </div>
    </div>
  );
}

function BreakdownPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gradient-card rounded-2xl p-4 sm:p-5">
      <h3 className="mb-4 font-black text-white">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function BreakdownRow({
  label,
  subLabel,
  value,
  share,
}: {
  label: string;
  subLabel: string;
  value: string;
  share?: number;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-gray-500">{subLabel}</p>
        </div>
        <p className="shrink-0 text-sm font-black text-white">{value}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/5">
        <div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.min(Math.max(share ?? 0, 0), 100)}%` }} />
      </div>
    </div>
  );
}

function InfoChip({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/20 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? 'font-black text-white' : 'font-semibold text-gray-300'}`}>{value}</p>
    </div>
  );
}
