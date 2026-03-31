import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, WifiOff, Wrench, RefreshCw, Power, Activity } from 'lucide-react';
import { MOCK_MACHINES, type Machine } from '@/services/mockData';
import api, { USE_API } from '@/services/api';

const statusConfig = {
  idle: { label: 'ว่าง', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: Wifi },
  busy: { label: 'กำลังใช้งาน', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Activity },
  maintenance: { label: 'ซ่อมบำรุง', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Wrench },
  offline: { label: 'Offline', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: WifiOff },
};

export function MachinesPage() {
  const [filter, setFilter] = useState<string>('all');
  const [machinesData, setMachinesData] = useState<Machine[]>(MOCK_MACHINES);

  useEffect(() => {
    if (!USE_API) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.fetchMachines();
        if (!cancelled) setMachinesData(data);
      } catch { /* keep mock data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'all' ? machinesData : machinesData.filter(m => m.status === filter);

  const countByStatus = {
    all: machinesData.length,
    idle: machinesData.filter(m => m.status === 'idle').length,
    busy: machinesData.filter(m => m.status === 'busy').length,
    maintenance: machinesData.filter(m => m.status === 'maintenance').length,
    offline: machinesData.filter(m => m.status === 'offline').length,
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h2 className="text-2xl font-bold text-white">สถานะเครื่อง IoT</h2>
        <p className="text-gray-500 text-sm mt-0.5">ดูและจัดการเครื่องล้างรถ ESP32 ทุกสาขา</p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries({ all: 'ทั้งหมด', idle: 'ว่าง', busy: 'ใช้งาน', maintenance: 'ซ่อม', offline: 'Offline' }).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`p-3 rounded-xl text-center transition-all ${
              filter === key ? 'bg-red-500/15 border border-red-500/30' : 'gradient-card hover:border-gray-700'
            }`}
          >
            <p className={`text-xl font-bold ${filter === key ? 'text-red-400' : 'text-white'}`}>
              {countByStatus[key as keyof typeof countByStatus]}
            </p>
            <p className="text-xs text-gray-500">{label}</p>
          </button>
        ))}
      </div>

      {/* Machine Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(machine => {
          const config = statusConfig[machine.status];
          const StatusIcon = config.icon;
          const timeSinceHeartbeat = Math.round((Date.now() - machine.lastHeartbeat.getTime()) / 1000);
          const heartbeatText = timeSinceHeartbeat < 60 ? `${timeSinceHeartbeat}s ago` :
            timeSinceHeartbeat < 3600 ? `${Math.floor(timeSinceHeartbeat / 60)}m ago` :
            `${Math.floor(timeSinceHeartbeat / 3600)}h ago`;

          return (
            <div key={machine.id} className={`gradient-card rounded-2xl p-5 border ${config.border} transition-all`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
                    <Cpu className={`w-6 h-6 ${config.color}`} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{machine.name}</h3>
                    <p className="text-xs text-gray-500">{machine.branchName}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${config.bg} ${config.color}`}>
                  <StatusIcon className="w-3 h-3 inline mr-1" />
                  {config.label}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">ESP32 ID</span>
                  <span className="text-gray-300 font-mono text-[10px]">{machine.espDeviceId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">ประเภท</span>
                  <span className="text-gray-300">{machine.type === 'car' ? 'รถยนต์' : 'มอเตอร์ไซค์'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">ล้างทั้งหมด</span>
                  <span className="text-gray-300">{machine.totalWashes.toLocaleString()} ครั้ง</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Heartbeat</span>
                  <span className={`font-medium ${timeSinceHeartbeat > 300 ? 'text-red-400' : 'text-green-400'}`}>
                    {heartbeatText}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Restart
                </button>
                <button className="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-1">
                  <Wrench className="w-3 h-3" /> Maintenance
                </button>
                <button className="py-2 px-3 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
