import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Download, Calendar,
  ArrowUpRight, BarChart2, Banknote
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { MOCK_REVENUE, MOCK_BRANCHES, MOCK_PACKAGE_STATS, getOverviewStats, type DailyRevenue, type Branch } from '@/services/mockData';
import api, { USE_API } from '@/services/api';

type Period = '7' | '30' | '90';

const PERIOD_LABELS: Record<Period, string> = { '7': '7 วัน', '30': '30 วัน', '90': '90 วัน' };

const CHART_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];

export function RevenuePage() {
  const [period, setPeriod] = useState<Period>('30');
  const [revenueData, setRevenueData] = useState<DailyRevenue[]>(MOCK_REVENUE);
  const [branchesData, setBranchesData] = useState<Branch[]>(MOCK_BRANCHES);

  useEffect(() => {
    if (!USE_API) return;
    let cancelled = false;
    (async () => {
      try {
        const [revRes, branchData] = await Promise.all([
          api.fetchRevenue(90),
          api.fetchBranches(),
        ]);
        if (cancelled) return;
        const mapped: DailyRevenue[] = revRes.data.dailyRevenue.map(r => ({
          date: r.date,
          revenue: r.total,
          sessions: 0,
          avgTicket: 0,
        }));
        setRevenueData(mapped);
        setBranchesData(branchData);
      } catch { /* keep mock data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const slicedRevenue = revenueData.slice(-Number(period));
  const periodRevenue = slicedRevenue.reduce((s, d) => s + d.revenue, 0);
  const periodSessions = slicedRevenue.reduce((s, d) => s + d.sessions, 0);
  const avgTicket = periodSessions > 0 ? periodRevenue / periodSessions : 0;

  const activeBranches = branchesData.filter(b => b.isActive);

  const summaryCards = [
    {
      label: `รายได้รวม ${PERIOD_LABELS[period]}`,
      value: periodRevenue.toLocaleString(),
      unit: 'บาท',
      change: '+11.4%',
      up: true,
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: `Session ทั้งหมด ${PERIOD_LABELS[period]}`,
      value: periodSessions.toLocaleString(),
      unit: 'ครั้ง',
      change: '+8.2%',
      up: true,
      icon: BarChart2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'ค่าเฉลี่ย/Session',
      value: Math.round(avgTicket).toLocaleString(),
      unit: 'บาท',
      change: '+3.1%',
      up: true,
      icon: Banknote,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'รายได้สูงสุดวันเดียว',
      value: Math.max(...slicedRevenue.map(d => d.revenue)).toLocaleString(),
      unit: 'บาท',
      change: '',
      up: true,
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">รายได้ & การเงิน</h2>
          <p className="text-gray-500 text-sm mt-0.5">วิเคราะห์รายได้ทุกสาขา</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-gray-700/50">
            {(['7', '30', '90'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-white'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-gray-700/50 text-gray-300 text-sm hover:bg-white/10 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="gradient-card rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {card.change && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${card.up ? 'text-green-400' : 'text-red-400'}`}>
                    {card.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {card.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-white">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label} <span className="text-gray-600">{card.unit}</span></p>
            </div>
          );
        })}
      </div>

      {/* Revenue Trend Chart */}
      <div className="gradient-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-semibold">แนวโน้มรายได้</h3>
            <p className="text-xs text-gray-500 mt-0.5">รายได้และ session ตามวัน</p>
          </div>
          <Calendar className="w-4 h-4 text-gray-600" />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={slicedRevenue}>
            <defs>
              <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              interval={period === '7' ? 0 : period === '30' ? 4 : 13}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
              labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              formatter={(value: number, name: string) => [
                name === 'revenue' ? `${value.toLocaleString()} บาท` : value,
                name === 'revenue' ? 'รายได้' : 'Sessions',
              ]}
            />
            <Area type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={2} fill="url(#revGrad2)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Branch Comparison + Package breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Branch Revenue */}
        <div className="gradient-card rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">รายได้ตามสาขา (วันนี้)</h3>
          <div className="space-y-3">
            {activeBranches
              .sort((a, b) => b.todayRevenue - a.todayRevenue)
              .map((branch, i) => {
                const maxRev = Math.max(...activeBranches.map(b => b.todayRevenue));
                const pct = maxRev > 0 ? (branch.todayRevenue / maxRev) * 100 : 0;
                return (
                  <div key={branch.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-4 text-right">{i + 1}</span>
                        <span className="text-sm text-gray-300">{branch.name.replace('ROBOSS ', '')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-white">{branch.todayRevenue.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-500 ml-1">บาท</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Package Revenue Breakdown */}
        <div className="gradient-card rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">รายได้ตามแพ็กเกจ</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MOCK_PACKAGE_STATS} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={110} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                formatter={(v: number) => [`${v.toLocaleString()} บาท`, 'รายได้']}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {MOCK_PACKAGE_STATS.map((_, i) => (
                  <rect key={i} fill={CHART_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {MOCK_PACKAGE_STATS.map((pkg, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i] }} />
                  <span className="text-gray-400">{pkg.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{pkg.sessions} ครั้ง</span>
                  <span className="text-white font-semibold">{pkg.revenue.toLocaleString()} บาท</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Revenue Table */}
      <div className="gradient-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">รายละเอียดรายวัน</h3>
          <span className="text-xs text-gray-600">{PERIOD_LABELS[period]}</span>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto no-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="border-b border-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">วันที่</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">รายได้</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">เฉลี่ย/Session</th>
              </tr>
            </thead>
            <tbody>
              {[...slicedRevenue].reverse().map(day => (
                <tr key={day.date} className="border-b border-gray-800/30 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-gray-300">
                    {new Date(day.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-white">{day.revenue.toLocaleString()} บาท</td>
                  <td className="px-5 py-3 text-right text-gray-400">{day.sessions}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{day.avgTicket.toLocaleString()} บาท</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
