import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { type AdminUser, type RevenueData } from '@/services/api';

interface RevenuePageProps {
  admin: AdminUser;
  branchId: string | null;
}

export function RevenuePage({ branchId }: RevenuePageProps) {
  const [วัน, setDays] = useState(30);
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.fetchRevenue(วัน, branchId);
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load revenue');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId, วัน]);

  const topแพ็กเกจ = useMemo(() => (data?.packageBreakdown ?? []).slice(0, 5), [data]);

  return (
    <div className="max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">รายได้</h2>
          <p className="mt-1 text-sm text-gray-500">ประสิทธิภาพการชำระเงินที่ยืนยันแล้วในขอบเขตสาขาปัจจุบัน</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
                วัน === value ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.03] text-gray-400 hover:text-white'
              }`}
            >
              {value} วัน
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="gradient-card rounded-2xl p-5">
          <p className="text-sm text-gray-500">รายได้รวม</p>
          <p className="mt-2 text-3xl font-black text-white">{(data?.totalRevenue ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-600">THB</p>
        </div>
        <div className="gradient-card rounded-2xl p-5">
          <p className="text-sm text-gray-500">รอบที่ยืนยันแล้ว</p>
          <p className="mt-2 text-3xl font-black text-white">{(data?.sessionCount ?? 0).toLocaleString()}</p>
        </div>
        <div className="gradient-card rounded-2xl p-5">
          <p className="text-sm text-gray-500">ค่าเฉลี่ยต่อรอบ</p>
          <p className="mt-2 text-3xl font-black text-white">{(data?.avgTicket ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-600">บาท / รอบ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="gradient-card rounded-2xl p-5 xl:col-span-2">
          <h3 className="mb-4 font-semibold text-white">แนวโน้มรายได้รายวัน</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data?.dailyRevenue ?? []}>
              <defs>
                <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
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
              <Area dataKey="total" type="monotone" stroke="#ef4444" fill="url(#revenueAreaFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="gradient-card rounded-2xl p-5">
          <h3 className="mb-4 font-semibold text-white">แพ็กเกจยอดนิยม</h3>
          <div className="space-y-3">
            {topแพ็กเกจ.map((pkg) => (
              <div key={pkg.packageId} className="rounded-xl bg-white/[0.03] px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{pkg.name}</span>
                  <span className="text-sm font-semibold text-white">{pkg.total.toLocaleString()}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{pkg.sessions} รอบที่ยืนยันแล้ว</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="gradient-card rounded-2xl p-5">
          <h3 className="mb-4 font-semibold text-white">สัดส่วนรายได้ตามสาขา</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.branchTotals ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                formatter={(value: number) => [value.toLocaleString(), 'รายได้']}
              />
              <Bar dataKey="total" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="gradient-card rounded-2xl p-5">
          <h3 className="mb-4 font-semibold text-white">สรุปรายวัน</h3>
          <div className="space-y-3 lg:hidden">
            {[...(data?.dailyRevenue ?? [])].reverse().map((day) => (
              <div key={day.date} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{day.date}</p>
                  <p className="text-sm font-semibold text-white">{day.total.toLocaleString()} บาท</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <p className="text-gray-500">รอบล้าง</p>
                    <p className="mt-1 text-gray-200">{day.sessions}</p>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <p className="text-gray-500">Avg ticket</p>
                    <p className="mt-1 text-gray-200">{day.avgTicket.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden max-h-72 overflow-y-auto no-scrollbar lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="px-2 py-3 text-left text-xs uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">รายได้</th>
                  <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">รอบล้าง</th>
                  <th className="px-2 py-3 text-right text-xs uppercase tracking-wider text-gray-500">Avg ticket</th>
                </tr>
              </thead>
              <tbody>
                {[...(data?.dailyRevenue ?? [])].reverse().map((day) => (
                  <tr key={day.date} className="border-b border-gray-800/30">
                    <td className="px-2 py-3 text-gray-300">{day.date}</td>
                    <td className="px-2 py-3 text-right text-white">{day.total.toLocaleString()}</td>
                    <td className="px-2 py-3 text-right text-gray-300">{day.sessions}</td>
                    <td className="px-2 py-3 text-right text-gray-300">{day.avgTicket.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}



