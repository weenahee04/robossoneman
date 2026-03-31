import React, { useState, useEffect } from 'react';
import {
  Building2, MapPin, Clock, Star, MoreVertical, Plus,
  Search, ExternalLink, Activity, TrendingUp,
} from 'lucide-react';
import { MOCK_BRANCHES, MOCK_MACHINES, MOCK_SESSIONS, type Branch, type Machine } from '@/services/mockData';
import api, { USE_API } from '@/services/api';

export function BranchesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [branchesData, setBranchesData] = useState(MOCK_BRANCHES);
  const [machinesData, setMachinesData] = useState<Machine[]>(MOCK_MACHINES);

  useEffect(() => {
    if (!USE_API) return;
    let cancelled = false;
    (async () => {
      try {
        const [b, m] = await Promise.all([api.fetchBranches(), api.fetchMachines()]);
        if (!cancelled) { setBranchesData(b); setMachinesData(m); }
      } catch { /* keep mock data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const areas = ['all', ...Array.from(new Set(branchesData.map(b => b.area)))];

  const filtered = branchesData.filter(b => {
    const matchSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.area.toLowerCase().includes(search.toLowerCase()) ||
      b.address.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' ? b.isActive : !b.isActive);
    const matchArea = areaFilter === 'all' || b.area === areaFilter;
    return matchSearch && matchFilter && matchArea;
  });

  const totalRevenue = branchesData.reduce((s, b) => s + b.todayRevenue, 0);
  const totalSessions = branchesData.reduce((s, b) => s + b.todaySessions, 0);
  const activeBranches = branchesData.filter(b => b.isActive).length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">จัดการสาขา</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeBranches} จาก {branchesData.length} สาขาเปิดให้บริการ
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium text-sm hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/20">
          <Plus className="w-4 h-4" /> เพิ่มสาขาใหม่
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="gradient-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{activeBranches}</p>
            <p className="text-xs text-gray-500">สาขาเปิดบริการ</p>
          </div>
        </div>
        <div className="gradient-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{totalSessions}</p>
            <p className="text-xs text-gray-500">Session วันนี้</p>
          </div>
        </div>
        <div className="gradient-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              ฿{(totalRevenue / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-gray-500">รายได้วันนี้</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาสาขา, ที่อยู่, จังหวัด..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-all"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'inactive'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === f ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'เปิดให้บริการ' : 'ปิดปรับปรุง'}
            </button>
          ))}
        </div>
        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-red-500/50"
        >
          {areas.map(a => (
            <option key={a} value={a} className="bg-gray-900">
              {a === 'all' ? 'ทุกจังหวัด' : a}
            </option>
          ))}
        </select>
      </div>

      {/* Branch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(branch => {
          const branchMachines = machinesData.filter(m => m.branchId === branch.id);
          const busyCount = branchMachines.filter(m => m.status === 'busy').length;
          const offlineCount = branchMachines.filter(m => m.status === 'offline' || m.status === 'maintenance').length;

          return (
            <div
              key={branch.id}
              className="gradient-card rounded-2xl p-5 hover:border-gray-700/80 transition-all group cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    branch.isActive ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    <Building2 className={`w-5 h-5 ${branch.isActive ? 'text-green-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm leading-tight">{branch.name}</h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      branch.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {branch.isActive ? '● เปิดบริการ' : '● ปิดปรับปรุง'}
                    </span>
                  </div>
                </div>
                <button className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Address */}
              <div className="mb-3">
                <p className="text-xs text-gray-400 leading-relaxed">{branch.address}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{branch.operatingHours.open} – {branch.operatingHours.close}</span>
                    <span className="text-gray-600">•</span>
                    <Star className="w-3 h-3 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">{branch.avgRating}</span>
                  </div>
                  {branch.mapsUrl && (
                    <a
                      href={branch.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      Google Maps
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {branch.location.lat.toFixed(4)}, {branch.location.lng.toFixed(4)}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
                  <p className="text-base font-bold text-white">{branch.machineCount}</p>
                  <p className="text-[10px] text-gray-500">เครื่อง</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
                  <p className="text-base font-bold text-blue-400">{branch.todaySessions}</p>
                  <p className="text-[10px] text-gray-500">session</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
                  <p className="text-base font-bold text-green-400">
                    {(branch.todayRevenue / 1000).toFixed(1)}k
                  </p>
                  <p className="text-[10px] text-gray-500">รายได้</p>
                </div>
              </div>

              {/* Machine Status Bar */}
              {branchMachines.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden flex gap-0.5">
                    {branchMachines.map(m => (
                      <div
                        key={m.id}
                        className={`flex-1 h-full rounded-full ${
                          m.status === 'busy' ? 'bg-blue-500' :
                          m.status === 'idle' ? 'bg-green-500' :
                          m.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {busyCount > 0 && <span className="text-blue-400">{busyCount} กำลังใช้</span>}
                    {offlineCount > 0 && <span className="text-red-400 ml-1">{offlineCount} ออฟไลน์</span>}
                    {busyCount === 0 && offlineCount === 0 && <span className="text-green-400">พร้อมใช้</span>}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>ไม่พบสาขาที่ค้นหา</p>
        </div>
      )}
    </div>
  );
}
