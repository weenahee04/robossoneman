import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Star, Eye } from 'lucide-react';
import { MOCK_SESSIONS, type WashSession } from '@/services/mockData';
import api, { USE_API } from '@/services/api';

const statusLabels: Record<string, { label: string; class: string }> = {
  waiting: { label: 'รอ', class: 'bg-gray-500/10 text-gray-400' },
  in_progress: { label: 'กำลังล้าง', class: 'bg-blue-500/10 text-blue-400' },
  completed: { label: 'เสร็จสิ้น', class: 'bg-green-500/10 text-green-400' },
  cancelled: { label: 'ยกเลิก', class: 'bg-red-500/10 text-red-400' },
};

const paymentLabels: Record<string, { label: string; class: string }> = {
  pending: { label: 'รอชำระ', class: 'bg-amber-500/10 text-amber-400' },
  confirmed: { label: 'ชำระแล้ว', class: 'bg-green-500/10 text-green-400' },
  failed: { label: 'ล้มเหลว', class: 'bg-red-500/10 text-red-400' },
};

export function SessionsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [sessionsData, setSessionsData] = useState<WashSession[]>(MOCK_SESSIONS);

  useEffect(() => {
    if (!USE_API) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.fetchSessions({ limit: 50 });
        if (!cancelled) setSessionsData(res.sessions);
      } catch { /* keep mock data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'all' ? sessionsData : sessionsData.filter(s => s.washStatus === filter);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">รายการล้างรถ</h2>
          <p className="text-gray-500 text-sm mt-0.5">ประวัติและ session ที่กำลังดำเนินการ</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-gray-700/50 text-gray-300 text-sm hover:bg-white/10 transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'ทั้งหมด', count: sessionsData.length },
          { key: 'in_progress', label: 'กำลังล้าง', count: sessionsData.filter(s => s.washStatus === 'in_progress').length },
          { key: 'completed', label: 'เสร็จสิ้น', count: sessionsData.filter(s => s.washStatus === 'completed').length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
              filter === tab.key ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
              filter === tab.key ? 'bg-red-500/30' : 'bg-gray-700'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      <div className="gradient-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ลูกค้า</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">สาขา</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">แพ็กเกจ</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ราคา</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ชำระเงิน</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">เวลา</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(session => {
                const washStatus = statusLabels[session.washStatus] || statusLabels.waiting;
                const payStatus = paymentLabels[session.paymentStatus] || paymentLabels.pending;
                const timeAgo = Math.round((Date.now() - session.createdAt.getTime()) / 60000);
                const timeText = timeAgo < 60 ? `${timeAgo} นาที` : `${Math.floor(timeAgo / 60)} ชม.`;

                return (
                  <tr key={session.id} className="border-b border-gray-800/30 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium">{session.customerName}</p>
                      <p className="text-gray-600 text-xs">{session.id}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-300">{session.branchName.replace('ROBOSS ', '')}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-gray-300">{session.packageName}</span>
                      <span className="text-gray-600 ml-1">({session.carSize})</span>
                    </td>
                    <td className="px-5 py-3.5 text-white font-medium">{session.totalPrice} บาท</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${payStatus.class}`}>
                        {payStatus.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${washStatus.class}`}>
                        {washStatus.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {session.rating ? (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-3 h-3 fill-current" /> {session.rating}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{timeText}</td>
                    <td className="px-5 py-3.5">
                      <button className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
