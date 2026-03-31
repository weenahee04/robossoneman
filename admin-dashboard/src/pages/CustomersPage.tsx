import React, { useState, useEffect } from 'react';
import { Search, Users, Crown, Star, TrendingUp, Gift, ChevronUp, ChevronDown } from 'lucide-react';
import { MOCK_CUSTOMERS, type Customer, type MemberTier } from '@/services/mockData';
import api, { USE_API } from '@/services/api';

const TIER_CONFIG: Record<MemberTier, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  bronze:   { label: 'Bronze',   color: 'text-amber-600',  bg: 'bg-amber-900/20',   border: 'border-amber-700/30',  icon: <Star className="w-3 h-3" /> },
  silver:   { label: 'Silver',   color: 'text-gray-300',   bg: 'bg-gray-700/30',    border: 'border-gray-600/30',   icon: <Star className="w-3 h-3" /> },
  gold:     { label: 'Gold',     color: 'text-yellow-400', bg: 'bg-yellow-500/15',  border: 'border-yellow-500/20', icon: <Crown className="w-3 h-3" /> },
  platinum: { label: 'Platinum', color: 'text-purple-400', bg: 'bg-purple-500/15',  border: 'border-purple-500/20', icon: <Crown className="w-3 h-3" /> },
};

const TIER_ORDER: MemberTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<MemberTier | 'all'>('all');
  const [sortField, setSortField] = useState<'points' | 'totalWashes' | 'totalSpend'>('points');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editingPoints, setEditingPoints] = useState<string | null>(null);
  const [customersData, setCustomersData] = useState<Customer[]>(MOCK_CUSTOMERS);

  useEffect(() => {
    if (!USE_API) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.fetchCustomers({ limit: 50 });
        if (!cancelled) setCustomersData(res.customers);
      } catch { /* keep mock data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = customersData
    .filter(c => {
      const matchSearch = c.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search);
      const matchTier = tierFilter === 'all' || c.memberTier === tierFilter;
      return matchSearch && matchTier;
    })
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return (a[sortField] - b[sortField]) * mul;
    });

  const totalCustomers = customersData.length;
  const tierCounts = TIER_ORDER.reduce((acc, t) => {
    acc[t] = customersData.filter(c => c.memberTier === t).length;
    return acc;
  }, {} as Record<MemberTier, number>);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-gray-700" />;
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-red-400" />
      : <ChevronUp className="w-3 h-3 text-red-400" />;
  };

  const timeAgo = (d: Date | null) => {
    if (!d) return 'ไม่มีข้อมูล';
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    if (mins < 1440) return `${Math.floor(mins / 60)} ชม.ที่แล้ว`;
    return `${Math.floor(mins / 1440)} วันที่แล้ว`;
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">จัดการลูกค้า</h2>
        <p className="text-gray-500 text-sm mt-0.5">ข้อมูลสมาชิกและคะแนน</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="gradient-card rounded-2xl p-4 col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-black text-white">{totalCustomers}</p>
              <p className="text-[10px] text-gray-500">ลูกค้าทั้งหมด</p>
            </div>
          </div>
        </div>
        {TIER_ORDER.map(tier => {
          const cfg = TIER_CONFIG[tier];
          return (
            <button
              key={tier}
              onClick={() => setTierFilter(tierFilter === tier ? 'all' : tier)}
              className={`gradient-card rounded-2xl p-4 text-left transition-all border ${
                tierFilter === tier ? `${cfg.border} ring-1 ring-inset ${cfg.border}` : 'border-transparent'
              }`}
            >
              <div className={`flex items-center gap-1.5 mb-1 ${cfg.color}`}>
                {cfg.icon}
                <span className="text-[11px] font-semibold uppercase tracking-wider">{cfg.label}</span>
              </div>
              <p className="text-xl font-black text-white">{tierCounts[tier]}</p>
              <p className="text-[10px] text-gray-500">คน</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="ค้นหาชื่อหรือเบอร์โทร..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
          />
        </div>
        <div className="flex gap-2">
          {(['all', ...TIER_ORDER] as const).map(t => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                tierFilter === t ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'all' ? 'ทั้งหมด' : TIER_CONFIG[t as MemberTier].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="gradient-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ลูกค้า</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ระดับสมาชิก</th>
                <th className="px-5 py-3.5">
                  <button
                    onClick={() => toggleSort('points')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    คะแนน <SortIcon field="points" />
                  </button>
                </th>
                <th className="px-5 py-3.5">
                  <button
                    onClick={() => toggleSort('totalWashes')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    ล้างทั้งหมด <SortIcon field="totalWashes" />
                  </button>
                </th>
                <th className="px-5 py-3.5">
                  <button
                    onClick={() => toggleSort('totalSpend')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    ยอดรวม <SortIcon field="totalSpend" />
                  </button>
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ล้างล่าสุด</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(customer => {
                const tier = TIER_CONFIG[customer.memberTier];
                return (
                  <tr key={customer.id} className="border-b border-gray-800/30 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                          {customer.displayName.charAt(2) || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{customer.displayName}</p>
                          <p className="text-gray-600 text-xs">{customer.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${tier.color} ${tier.bg} ${tier.border}`}>
                        {tier.icon} {tier.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{customer.points.toLocaleString()}</span>
                        {editingPoints === customer.id ? (
                          <button
                            onClick={() => setEditingPoints(null)}
                            className="text-[10px] text-red-400 hover:text-red-300"
                          >ยกเลิก</button>
                        ) : (
                          <button
                            onClick={() => setEditingPoints(customer.id)}
                            className="p-1 rounded text-gray-600 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                            title="ปรับคะแนน"
                          >
                            <Gift className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {editingPoints === customer.id && (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            autoFocus
                            type="number"
                            placeholder="±"
                            className="w-20 px-2 py-1 bg-white/5 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:border-green-500/50"
                          />
                          <button className="px-2 py-1 text-[10px] bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors" onClick={() => setEditingPoints(null)}>
                            บันทึก
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-300">{customer.totalWashes} ครั้ง</td>
                    <td className="px-5 py-3.5 font-medium text-white">{customer.totalSpend.toLocaleString()} บาท</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{timeAgo(customer.lastWash)}</td>
                    <td className="px-5 py-3.5">
                      <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-white hover:bg-white/5 px-2 py-1 rounded-lg transition-colors">
                        <TrendingUp className="w-3 h-3" /> ประวัติ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-gray-600">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>ไม่พบลูกค้า</p>
          </div>
        )}
      </div>
    </div>
  );
}
