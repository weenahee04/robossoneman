import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Car, Cpu, Star, 
  ArrowUpRight, Building2, Activity 
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  getOverviewStats, MOCK_REVENUE, MOCK_PACKAGE_STATS, 
  MOCK_BRANCHES, MOCK_MACHINES, MOCK_SESSIONS,
  type Branch, type Machine, type WashSession, type DailyRevenue,
} from '@/services/mockData';
import api, { USE_API } from '@/services/api';

function useDashboardData() {
  const mockStats = getOverviewStats();
  const [stats, setStats] = useState(mockStats);
  const [revenue, setRevenue] = useState(MOCK_REVENUE);
  const [branches, setBranches] = useState(MOCK_BRANCHES);
  const [machines, setMachines] = useState(MOCK_MACHINES);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);

  useEffect(() => {
    if (!USE_API) return;

    let cancelled = false;

    (async () => {
      try {
        const [dashRes, branchData, machineData, sessionRes] = await Promise.all([
          api.fetchDashboard(),
          api.fetchBranches(),
          api.fetchMachines(),
          api.fetchSessions({ limit: 10 }),
        ]);

        if (cancelled) return;

        const d = dashRes.data;
        const activeBranches = branchData.filter(b => b.isActive).length;
        const avgRating = activeBranches > 0
          ? branchData.filter(b => b.isActive).reduce((s, b) => s + b.avgRating, 0) / activeBranches
          : 0;

        setStats({
          totalRevenue: d.todayRevenue,
          totalSessions: d.todaySessions,
          activeBranches,
          totalBranches: d.totalBranches,
          machinesBusy: machineData.filter(m => m.status === 'busy').length,
          machinesIdle: machineData.filter(m => m.status === 'idle').length,
          machinesMaintenance: machineData.filter(m => m.status === 'maintenance' || m.status === 'offline').length,
          totalMachines: d.totalMachines,
          avgRating: Math.round(avgRating * 10) / 10,
          monthlyRevenue: 0,
          monthlySessions: 0,
        });

        setBranches(branchData);
        setMachines(machineData);
        setSessions(sessionRes.sessions);
      } catch {
        // fall back to mock data (already set as initial state)
      }

      if (cancelled) return;

      try {
        const revRes = await api.fetchRevenue(30);
        if (!cancelled) {
          const mapped: DailyRevenue[] = revRes.data.dailyRevenue.map(r => ({
            date: r.date,
            revenue: r.total,
            sessions: 0,
            avgTicket: 0,
          }));
          setRevenue(mapped);
          setStats(prev => ({
            ...prev,
            monthlyRevenue: revRes.data.totalRevenue,
            monthlySessions: revRes.data.sessionCount,
          }));
        }
      } catch {
        // keep mock revenue
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { stats, revenue, branches, machines, sessions };
}

const CHART_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];

export function DashboardPage() {
  const { stats, revenue, branches, machines, sessions } = useDashboardData();

  const statCards = [
    {
      label: 'รายได้วันนี้',
      value: `${(stats.totalRevenue).toLocaleString()}`,
      unit: 'บาท',
      change: '+12.5%',
      changeType: 'up' as const,
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      glow: 'stat-glow-green',
    },
    {
      label: 'Session วันนี้',
      value: stats.totalSessions.toString(),
      unit: 'ครั้ง',
      change: '+8.3%',
      changeType: 'up' as const,
      icon: Car,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      glow: 'stat-glow-blue',
    },
    {
      label: 'สาขาเปิดให้บริการ',
      value: `${stats.activeBranches}/${stats.totalBranches}`,
      unit: 'สาขา',
      change: '',
      changeType: 'neutral' as const,
      icon: Building2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      glow: 'stat-glow-amber',
    },
    {
      label: 'คะแนนรีวิวเฉลี่ย',
      value: stats.avgRating.toString(),
      unit: '/ 5.0',
      change: '+0.2',
      changeType: 'up' as const,
      icon: Star,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      glow: 'stat-glow-amber',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-white">ภาพรวมระบบ</h2>
        <p className="text-gray-500 text-sm mt-0.5">ข้อมูลสรุปทุกสาขา ROBOSS วันนี้</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`gradient-card rounded-2xl p-5 ${card.glow}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {card.change && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${
                    card.changeType === 'up' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {card.changeType === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 gradient-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">รายได้ 30 วัน</h3>
              <p className="text-xs text-gray-500">รายได้รวม {stats.monthlyRevenue.toLocaleString()} บาท</p>
            </div>
            <div className="flex gap-2">
              {['7D', '30D', '90D'].map((period, i) => (
                <button key={period} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  i === 1 ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}>{period}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(v) => new Date(v).getDate().toString()}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: number) => [`${value.toLocaleString()} บาท`, 'รายได้']}
                labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              />
              <Area type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={2} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Package Breakdown */}
        <div className="gradient-card rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">แพ็กเกจยอดนิยม</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={MOCK_PACKAGE_STATS}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                dataKey="sessions"
                paddingAngle={3}
              >
                {MOCK_PACKAGE_STATS.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                formatter={(value: number, name: string) => [value, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {MOCK_PACKAGE_STATS.map((pkg, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                  <span className="text-xs text-gray-400">{pkg.name}</span>
                </div>
                <span className="text-xs font-semibold text-white">{pkg.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Machine Status */}
        <div className="gradient-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">สถานะเครื่อง</h3>
            <span className="text-xs text-gray-500">{stats.totalMachines} เครื่อง</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-xl bg-green-500/5 border border-green-500/10">
              <p className="text-2xl font-bold text-green-400">{stats.machinesIdle}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">ว่าง</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-2xl font-bold text-blue-400">{stats.machinesBusy}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">กำลังใช้งาน</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-2xl font-bold text-red-400">{stats.machinesMaintenance}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">ซ่อม/Offline</p>
            </div>
          </div>
          <div className="space-y-2">
            {machines.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    m.status === 'idle' ? 'bg-green-400' : 
                    m.status === 'busy' ? 'bg-blue-400 animate-pulse' : 
                    m.status === 'maintenance' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <span className="text-sm text-white">{m.name}</span>
                  <span className="text-xs text-gray-600">({m.branchName})</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                  m.status === 'idle' ? 'bg-green-500/10 text-green-400' :
                  m.status === 'busy' ? 'bg-blue-500/10 text-blue-400' :
                  m.status === 'maintenance' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {m.status === 'idle' ? 'ว่าง' : m.status === 'busy' ? 'ใช้งาน' : m.status === 'maintenance' ? 'ซ่อม' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="gradient-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Session ล่าสุด</h3>
            <button className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
              ดูทั้งหมด <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{s.customerName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      s.washStatus === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                      s.washStatus === 'completed' ? 'bg-green-500/10 text-green-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {s.washStatus === 'in_progress' ? 'กำลังล้าง' : s.washStatus === 'completed' ? 'เสร็จสิ้น' : 'รอ'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.packageName} ({s.carSize}) - {s.branchName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{s.totalPrice} บาท</p>
                  <p className="text-[10px] text-gray-600">
                    {Math.round((Date.now() - s.createdAt.getTime()) / 60000)} นาทีที่แล้ว
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Branch Performance */}
      <div className="gradient-card rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4">รายได้ตามสาขา (วันนี้)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={branches.filter(b => b.isActive)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 9 }}
              tickFormatter={(v) => v.replace('ROBOSS ', '')}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
              formatter={(value: number) => [`${value.toLocaleString()} บาท`, 'รายได้']}
            />
            <Bar dataKey="todayRevenue" fill="#ef4444" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
