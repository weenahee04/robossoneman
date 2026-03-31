// TODO: Wire to admin API when packages/coupons endpoints are available.
// Currently using mock data only — no matching admin endpoints yet.
import React, { useState } from 'react';
import { Package, Tag, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, Car, Bike } from 'lucide-react';
import { MOCK_PACKAGES, MOCK_COUPONS, MOCK_BRANCHES } from '@/services/mockData';

const VEHICLE_LABELS = {
  car: { label: 'รถยนต์', color: 'text-blue-400' },
  motorcycle: { label: 'มอเตอร์ไซค์', color: 'text-green-400' },
  both: { label: 'ทุกคัน', color: 'text-purple-400' },
};

const getBranchName = (id: string) => {
  if (id === 'all') return 'ทุกสาขา';
  return MOCK_BRANCHES.find(b => b.id === id)?.name.replace('ROBOSS ', '') || id;
};

const daysLeft = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86400000);

export function PackagesPage() {
  const [activeTab, setActiveTab] = useState<'packages' | 'coupons'>('packages');
  const [showInactive, setShowInactive] = useState(false);

  const packages = showInactive ? MOCK_PACKAGES : MOCK_PACKAGES.filter(p => p.isActive);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">แพ็กเกจ & คูปอง</h2>
          <p className="text-gray-500 text-sm mt-0.5">จัดการบริการและโปรโมชั่น</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" />
          {activeTab === 'packages' ? 'เพิ่มแพ็กเกจ' : 'สร้างคูปอง'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['packages', 'coupons'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'packages' ? <Package className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
            {tab === 'packages' ? `แพ็กเกจ (${MOCK_PACKAGES.length})` : `คูปอง (${MOCK_COUPONS.length})`}
          </button>
        ))}
        {activeTab === 'packages' && (
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`ml-auto flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-colors ${
              showInactive ? 'text-green-400 bg-green-500/10' : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {showInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            แสดง inactive
          </button>
        )}
      </div>

      {/* Packages Grid */}
      {activeTab === 'packages' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map(pkg => {
            const vehicle = VEHICLE_LABELS[pkg.vehicleType];
            return (
              <div key={pkg.id} className={`gradient-card rounded-2xl p-5 transition-all ${!pkg.isActive && 'opacity-50'}`}>
                <div className="h-1 w-full rounded-full mb-4" style={{ backgroundColor: pkg.color, opacity: 0.7 }} />
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-bold">{pkg.name}</h3>
                    <span className={`text-[10px] ${vehicle.color}`}>{vehicle.label}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    pkg.isActive ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'
                  }`}>
                    {pkg.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(['S', 'M', 'L'] as const).map(size => (
                    <div key={size} className="bg-white/[0.03] rounded-xl p-2.5 text-center border border-gray-700/30">
                      <p className="text-[10px] text-gray-500 mb-1">ขนาด {size}</p>
                      <p className="text-white font-bold">{pkg.prices[size]}</p>
                      <p className="text-[10px] text-gray-600">บาท</p>
                    </div>
                  ))}
                </div>
                <div className="mb-4">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">ขั้นตอน</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.steps.map((step, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-md">
                        {i + 1}. {step}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" /> {pkg.duration} นาที
                  </div>
                  <span className="text-[10px] text-gray-600">{getBranchName(pkg.branchId)}</span>
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="gradient-card rounded-2xl p-5 border-2 border-dashed border-gray-700/50 hover:border-red-500/30 hover:bg-red-500/5 flex flex-col items-center justify-center gap-3 text-gray-600 hover:text-red-400 transition-all min-h-[240px]">
            <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-current flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium">เพิ่มแพ็กเกจใหม่</span>
          </button>
        </div>
      )}

      {/* Coupons Table */}
      {activeTab === 'coupons' && (
        <div className="gradient-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50">
                  {['รหัสคูปอง', 'ประเภท', 'ส่วนลด', 'ขั้นต่ำ', 'การใช้งาน', 'สาขา', 'หมดอายุ', 'สถานะ', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_COUPONS.map(coupon => {
                  const days = daysLeft(coupon.expiresAt);
                  const usedPct = Math.round((coupon.usedCount / coupon.maxUses) * 100);
                  return (
                    <tr key={coupon.id} className="border-b border-gray-800/30 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm font-bold tracking-widest text-white bg-white/5 px-2.5 py-1 rounded-lg">{coupon.code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium ${coupon.type === 'percent' ? 'text-blue-400' : 'text-green-400'}`}>
                          {coupon.type === 'percent' ? 'เปอร์เซ็นต์' : 'ลดตรง'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-white font-semibold">
                        {coupon.type === 'percent' ? `${coupon.value}%` : `${coupon.value} บาท`}
                      </td>
                      <td className="px-5 py-4 text-gray-400">{coupon.minOrder > 0 ? `${coupon.minOrder} บาท` : '-'}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>{coupon.usedCount}/{coupon.maxUses}</span>
                          <span>{usedPct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-24">
                          <div
                            className={`h-full rounded-full ${usedPct >= 90 ? 'bg-red-500' : usedPct >= 60 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">{getBranchName(coupon.branchId)}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs ${days < 0 ? 'text-red-400' : days < 30 ? 'text-amber-400' : 'text-gray-400'}`}>
                          {days < 0 ? 'หมดอายุ' : `${days} วัน`}
                        </span>
                        <p className="text-[10px] text-gray-600">{coupon.expiresAt.toLocaleDateString('th-TH')}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${coupon.isActive ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'}`}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1">
                          <button className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
